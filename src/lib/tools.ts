// My tools: what the warehouse lent you (tool_borrowings + the tools catalog), and reporting a problem with
// one, which files an Equipment ticket the coordinator sees in Tickets.
import { supabase } from './supabase';
import { fileTicket } from './fileTicket';

export type MyTool = {
  id: string;
  status: string;            // checked_out / returned / lost / damaged
  quantity: number;
  handedOverAt: string | null;
  returnedAt: string | null;
  name: string;
  category: string | null;
  serial: string | null;
  /** The tool's own ID from the warehouse, e.g. TC-DEW-0003 */
  tag: string | null;
  imageUrl: string | null;
  /** You reported a problem with it and HR hasn't closed the report yet */
  reported: boolean;
};

/** A tool request not answered yet (C5: shown under My tools as waiting). */
export type ToolAsk = { ref: string; tool: string; howMany: number; at: string };
export type MyToolLists = { withYou: MyTool[]; returned: MyTool[]; requested: ToolAsk[] };
let lastLoaded: MyToolLists | null = null; // so My tools reopens instantly and the report screen finds its tool
export const getLoadedTools = () => lastLoaded;
export const getLoadedTool = (id: string) => lastLoaded?.withYou.find((x) => x.id === id) ?? null;

export async function getMyTools(): Promise<MyToolLists> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { withYou: [], returned: [], requested: [] };
  const [{ data, error }, { data: reports }, { data: asks }] = await Promise.all([
    supabase
      .from('tool_borrowings')
      .select('id, quantity, status, handed_over_at, returned_at, tool:tools ( name, category, serial_number, image_url ), unit:tool_units ( tag )')
      .eq('technician_id', user.id)
      .order('handed_over_at', { ascending: false })
      .limit(40),
    supabase.from('tickets').select('title').eq('employee_id', user.id).eq('category', 'Equipment / Tools').neq('status', 'resolved'),
    supabase.from('tickets').select('id, description, created_at').eq('employee_id', user.id).eq('category', 'Tool request').in('status', ['open', 'in_progress']).order('created_at', { ascending: false }),
  ]);
  if (error) throw error;
  // shortcut: a report is matched to the tool by its title ("Tool problem: <name>"), so two borrowings of the same
  // tool both show it; store the borrowing id on the ticket if that ever matters
  const reported = new Set((reports ?? []).map((r) => r.title.replace(/^Tool problem: /, '')));
  const tools: MyTool[] = (data ?? []).map((b) => {
    const tool = (Array.isArray(b.tool) ? b.tool[0] : b.tool) as { name?: string; category?: string; serial_number?: string; image_url?: string } | null;
    const unit = (Array.isArray(b.unit) ? b.unit[0] : b.unit) as { tag?: string } | null;
    return {
      id: b.id, status: b.status ?? 'checked_out', quantity: b.quantity ?? 1, handedOverAt: b.handed_over_at, returnedAt: b.returned_at,
      name: tool?.name ?? 'Tool', category: tool?.category ?? null, serial: tool?.serial_number ?? null, tag: unit?.tag ?? null, imageUrl: tool?.image_url ?? null,
      reported: reported.has(tool?.name ?? 'Tool'),
    };
  });
  const line = (text: string, label: string) => text.split('\n').find((l) => l.startsWith(`${label}: `))?.slice(label.length + 2) ?? '';
  const requested = (asks ?? []).map((a) => ({ ref: `#${a.id.slice(0, 8).toUpperCase()}`, tool: line(a.description, 'Tool'), howMany: Number(line(a.description, 'How many')) || 1, at: a.created_at ?? '' }));
  lastLoaded = { withYou: tools.filter((x) => x.status === 'checked_out'), returned: tools.filter((x) => x.status !== 'checked_out').slice(0, 10), requested };
  return lastLoaded;
}

/** Days since the tool was handed over (0 = today). */
export const daysWithYou = (tool: MyTool) =>
  tool.handedOverAt ? Math.max(0, Math.floor((Date.now() - Date.parse(tool.handedOverAt)) / 86400000)) : 0;

export async function reportToolProblem(tool: MyTool, problem: string, note: string): Promise<boolean> {
  const ref = await fileTicket({
    category: 'Equipment / Tools',
    title: `Tool problem: ${tool.name}`,
    description: [`Tool: ${tool.name}${tool.tag ? ` (${tool.tag})` : tool.serial ? ` (SN ${tool.serial})` : ''}`, `Problem: ${problem}`, note.trim() ? `Details: ${note.trim()}` : null].filter(Boolean).join('\n'),
    priority: 'medium',
  }, (r) => `🛠️ Tool problem: ${tool.name}: ${problem}${note.trim() ? `. Note: ${note.trim()}` : ''} (ticket ${r})`);
  return ref !== null;
}

/** A tool in the warehouse you can ask for (tool requests, prof 20 Nov: "everything needs to be documented"). */
export type CatalogTool = { id: string; name: string; category: string; available: number };

export async function getToolCatalog(): Promise<CatalogTool[]> {
  const { data, error } = await supabase.from('tools').select('id, name, category, available_stock, status').order('name');
  if (error) throw error;
  return (data ?? []).filter((x) => x.status !== 'retired').map((x) => ({ id: x.id, name: x.name, category: x.category, available: x.available_stock ?? 0 }));
}

/** Asks the Coordinator for a tool: a "Tool request" ticket (the Coordinator lends it, or says why not). */
export async function requestTool(tool: CatalogTool, howMany: number, neededOn: string, why: string, delivery: 'pickup' | 'driver'): Promise<string | null> {
  return fileTicket({
    category: 'Tool request',
    title: `Tool request: ${tool.name}`,
    description: [`Tool: ${tool.name}`, `How many: ${howMany}`, `Needed on: ${neededOn}`, `Delivery: ${delivery}`, why.trim() ? `Why: ${why.trim()}` : null].filter(Boolean).join('\n'),
    priority: 'medium',
  }, (r) => `🧰 Tool request: ${howMany} × ${tool.name}, needed on ${neededOn}${why.trim() ? `. Why: ${why.trim()}` : ''} (ticket ${r})`);
}

/** Several tools at once (C5): one request per kind of tool, so the Coordinator lends each as usual. Ticket numbers, or null if none went. */
export async function requestTools(picks: { tool: CatalogTool; howMany: number }[], neededOn: string, why: string, delivery: 'pickup' | 'driver'): Promise<string[] | null> {
  const refs: string[] = [];
  for (const p of picks) {
    const ref = await requestTool(p.tool, p.howMany, neededOn, why, delivery);
    if (!ref) return refs.length ? refs : null;
    refs.push(ref);
  }
  return refs;
}

