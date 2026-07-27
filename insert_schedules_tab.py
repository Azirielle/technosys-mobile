import os
import re

def insert_schedules_tab(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Import SchedulesTab
    import_tickets = "import TicketsTab from '../components/TicketsTab';"
    import_schedules = "import TicketsTab from '../components/TicketsTab';\nimport SchedulesTab from '../components/SchedulesTab';"
    if "SchedulesTab" not in content:
        content = content.replace(import_tickets, import_schedules)

    # Update state type
    state_orig = "const [activeTab, setActiveTab] = useState<'home' | 'payslip' | 'profile' | 'tickets'>('home');"
    state_new = "const [activeTab, setActiveTab] = useState<'home' | 'schedules' | 'payslip' | 'profile' | 'tickets'>('home');"
    content = content.replace(state_orig, state_new)

    # Update active tab rendering
    render_tickets = "{activeTab === 'tickets' && (\n            <TicketsTab userId={session.user.id} fullName={profile?.full_name || 'Technician'} language={language} isOnline={isOnline} isDarkMode={isDarkMode} />\n          )}"
    render_schedules = "{activeTab === 'schedules' && (\n            <SchedulesTab userId={session.user.id} language={language} isOnline={isOnline} />\n          )}\n\n          " + render_tickets
    if "<SchedulesTab" not in content:
        content = content.replace(render_tickets, render_schedules)

    # Update bottom navigation bar
    home_tab = """          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Feather name="home" size={24} color={activeTab === 'home' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'home' ? COLORS.primary : COLORS.textMuted }]}>{t('homeTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'home' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>"""
          
    schedules_tab = home_tab + """

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('schedules')}>
            <Feather name="calendar" size={24} color={activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted }]}>{language === 'fil' ? 'Iskedyul' : 'Schedule'}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'schedules' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>"""

    if "setActiveTab('schedules')" not in content:
        content = content.replace(home_tab, schedules_tab)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

insert_schedules_tab('src/app/index.tsx')
