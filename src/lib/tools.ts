// My tools: what the warehouse lent you (tool_borrowings + the tools catalog), and reporting a problem with
// one, which files an Equipment ticket the coordinator sees in Tickets.
import { supabase } from './supabase';

export type MyTool = {
  id: string;
  status: string;            // checked_out / returned / lost / damaged
  quantity: number;
  handedOverAt: string | null;
  returnedAt: string | null;
  name: string;
  category: string | null;
  serial: string | null;
  imageUrl: string | null;
  /** You reported a problem with it and HR hasn't closed the report yet */
  reported: boolean;
};

export type MyToolLists = { withYou: MyTool[]; returned: MyTool[] };
let lastLoaded: MyToolLists | null = null; // so My tools reopens instantly and the report screen finds its tool
export const getLoadedTools = () => lastLoaded;
export const getLoadedTool = (id: string) => lastLoaded?.withYou.find((x) => x.id === id) ?? null;

export async function getMyTools(): Promise<MyToolLists> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { withYou: [], returned: [] };
  const [{ data, error }, { data: reports }] = await Promise.all([
    supabase
      .from('tool_borrowings')
      .select('id, quantity, status, handed_over_at, returned_at, tool:tools ( name, category, serial_number, image_url )')
      .eq('technician_id', user.id)
      .order('handed_over_at', { ascending: false })
      .limit(40),
    supabase.from('tickets').select('title').eq('employee_id', user.id).eq('category', 'Equipment / Tools').neq('status', 'resolved'),
  ]);
  if (error) throw error;
  // shortcut: a report is matched to the tool by its title ("Tool problem: <name>"), so two borrowings of the same
  // tool both show it; store the borrowing id on the ticket if that ever matters
  const reported = new Set((reports ?? []).map((r) => r.title.replace(/^Tool problem: /, '')));
  const tools: MyTool[] = (data ?? []).map((b) => {
    const tool = (Array.isArray(b.tool) ? b.tool[0] : b.tool) as { name?: string; category?: string; serial_number?: string; image_url?: string } | null;
    return {
      id: b.id, status: b.status ?? 'checked_out', quantity: b.quantity ?? 1, handedOverAt: b.handed_over_at, returnedAt: b.returned_at,
      name: tool?.name ?? 'Tool', category: tool?.category ?? null, serial: tool?.serial_number ?? null, imageUrl: tool?.image_url ?? null,
      reported: reported.has(tool?.name ?? 'Tool'),
    };
  });
  lastLoaded = { withYou: tools.filter((x) => x.status === 'checked_out'), returned: tools.filter((x) => x.status !== 'checked_out').slice(0, 10) };
  return lastLoaded;
}

/** Days since the tool was handed over (0 = today). */
export const daysWithYou = (tool: MyTool) =>
  tool.handedOverAt ? Math.max(0, Math.floor((Date.now() - Date.parse(tool.handedOverAt)) / 86400000)) : 0;

export async function reportToolProblem(tool: MyTool, problem: string, note: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: activeChats } = await supabase.from('tickets')
    .select('id').eq('employee_id', user.id).eq('title', 'Support Conversation')
    .in('status', ['open', 'in_progress']).order('created_at', { ascending: false }).limit(1);
  const parentId = activeChats?.[0]?.id ?? null;

  const { data: created, error } = await supabase.from('tickets').insert({
    employee_id: user.id,
    category: 'Equipment / Tools',
    title: `Tool problem: ${tool.name}`,
    description: [`Tool: ${tool.name}${tool.serial ? ` (SN ${tool.serial})` : ''}`, `Problem: ${problem}`, note.trim() ? `Details: ${note.trim()}` : null].filter(Boolean).join('\n'),
    priority: 'medium',
    status: 'open',
    from_ticket_id: parentId,
  }).select('id').single();
  if (error || !created) return false;

  if (parentId) {
    const ref = `#${created.id.slice(0, 8).toUpperCase()}`;
    await supabase.from('ticket_comments').insert({
      ticket_id: parentId,
      author_id: user.id,
      content: `Your tool report is sent (ticket ${ref}). The office will reply here.`,
      sender_role: 'technician',
    });
  }
  return true;
}
