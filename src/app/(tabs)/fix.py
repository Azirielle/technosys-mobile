import sys

with open('index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if '// Chunk 13.2 States' in line:
        new_lines.append(line)
        new_lines.append('''  const [dtrModalVisible, setDtrModalVisible] = useState(false);
  const [formsModalVisible, setFormsModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [dtrLogs, setDtrLogs] = useState<any[]>([]);
  const [dtrLoading, setDtrLoading] = useState(false);

  // Chunk 14: Notifications
  const [notifVisible, setNotifVisible] = useState(false);
  const notifAnim = useRef(new Animated.Value(width)).current;
  const [dispatchVisible, setDispatchVisible] = useState(false);

  const [notifications, setNotifications] = useState([
    { id: 1, type: 'dispatch', title: 'New Direct Dispatch', desc: 'Assigned to Makati HQ for Maintenance.', time: '10m ago', read: false },
    { id: 2, type: 'hr', title: 'Photo Override Approved', desc: 'Your clock-in at 8:05 AM was verified by HR.', time: '1h ago', read: false },
    { id: 3, type: 'tool', title: 'Tool Checkout', desc: 'Heavy Drill #442 assigned to you.', time: '2h ago', read: true },
    { id: 4, type: 'admin', title: 'Payslip Available', desc: 'Your payslip for Aug 15 is now ready for viewing.', time: '1d ago', read: true },
    { id: 5, type: 'help', title: 'Ticket Updated', desc: 'IT Support replied to Ticket #1042.', time: '2d ago', read: true },
  ]);
  const [selectedNotif, setSelectedNotif] = useState<any>(null);
  const unreadCount = notifications.filter(n => !n.read).length;

  // Chunk 15: Equipment Menu
  const [equipModalVisible, setEquipModalVisible] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  const fetchEquipment = async () => {
    setToolsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('tool_assignments')
        .select(
          id, quantity, borrowed_at, returned_at, status, notes,
          tool_catalog ( id, name, image_url )
        )
        .eq('technician_id', user.id)
        .order('borrowed_at', { ascending: false });
      
      setTools(data || []);
    }
    setToolsLoading(false);
  };

  // Chunk 16: Support & Ticketing
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [createTicketMode, setCreateTicketMode] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  const [ticketForm, setTicketForm] = useState({ title: '', category: 'HR & Payroll', description: '' });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  const TICKET_CATEGORIES = ['HR & Payroll', 'IT & App Support', 'Equipment / Tools', 'Schedule & Dispatch'];

  const fetchTickets = async () => {
    setTicketsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('tickets')
        .select('*')
''')
        skip = True
    elif skip and ".eq('employee_id', user.id)" in line:
        skip = False
        new_lines.append(line)
    elif not skip:
        new_lines.append(line)

with open('index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
