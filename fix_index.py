import os

def fix_index(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        c = f.read()

    # 1. Leave Portal Redirect
    c = c.replace(
        "onPress={() => { setShowLeavesModal(true); fetchLeaves(); }}",
        "onPress={() => setActiveTab('support')}"
    )

    # 2. Roles Format
    c = c.replace(
        "{profile?.role === 'technician' ? t('fieldTechnician') : profile?.role === 'helper' ? t('fieldHelper') : t('active')}",
        "{profile?.role ? profile.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : t('active')}"
    )
    c = c.replace(
        "const badgeLabel = isTechnician ? t('fieldTechnician') : isHelper ? t('fieldHelper') : t('active');",
        "const badgeLabel = (sched as any)?.profiles?.role ? (sched as any).profiles.role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Technician';"
    )

    # 3. Dates
    c = c.replace("{ month: 'short', day: 'numeric', year: 'numeric' }", "{ month: 'long', day: 'numeric', year: 'numeric' }")
    c = c.replace("{ month: 'short', day: 'numeric' }", "{ month: 'long', day: 'numeric' }")
    c = c.replace("{payslip.period_start}", "{new Date(payslip.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}")
    c = c.replace("{payslip.period_end}", "{new Date(payslip.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}")
    c = c.replace("{payslip?.period_start}", "{payslip?.period_start ? new Date(payslip.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}")
    c = c.replace("{payslip?.period_end}", "{payslip?.period_end ? new Date(payslip.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}")

    # 4. State
    c = c.replace(
        "const [searchPayslip, setSearchPayslip] = useState('');",
        "const [searchPayslip, setSearchPayslip] = useState('');\n  const [showPayslipHistory, setShowPayslipHistory] = useState(false);"
    )
    c = c.replace(
        "const [activeTab, setActiveTab] = useState<'home' | 'payslip' | 'profile' | 'tickets'>('home');",
        "const [activeTab, setActiveTab] = useState<'home' | 'schedules' | 'payslip' | 'profile' | 'tickets'>('home');"
    )

    # 5. Imports
    c = c.replace(
        "import TicketsTab from '../components/TicketsTab';",
        "import TicketsTab from '../components/TicketsTab';\nimport SchedulesTab from '../components/SchedulesTab';"
    )

    # 6. Navigation Bar
    nav_home = """          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
            <Feather name="home" size={24} color={activeTab === 'home' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'home' ? COLORS.primary : COLORS.textMuted }]}>{t('homeTab')}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'home' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>"""
    nav_sched = nav_home + """\n\n          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('schedules')}>
            <Feather name="calendar" size={24} color={activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted} />
            <Text style={[styles.navText, { color: activeTab === 'schedules' ? COLORS.primary : COLORS.textMuted }]}>{language === 'fil' ? 'Iskedyul' : 'Schedule'}</Text>
            <View style={[styles.navDot, { backgroundColor: activeTab === 'schedules' ? COLORS.primary : 'transparent' }]} />
          </TouchableOpacity>"""
    c = c.replace(nav_home, nav_sched)

    # 8. Payslip Search input replacement
    old_search = """              <TextInput 
                placeholder={language === 'fil' ? 'Hanapin ang Petsa o Halaga...' : 'Search Date or Amount...'} 
                placeholderTextColor={COLORS.textMuted}
                style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}
                value={searchPayslip}
                onChangeText={setSearchPayslip}
              />"""
    new_search = """              <TouchableOpacity onPress={() => setShowPayslipHistory(true)} style={{ backgroundColor: COLORS.border, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: COLORS.textMain, fontWeight: 'bold' }}>{language === 'fil' ? 'Tingnan ang Kasaysayan' : 'View Payslip History'}</Text>
              </TouchableOpacity>"""
    c = c.replace(old_search, new_search)

    old_map2 = """                payslips
                  .filter(p => p.period_start.includes(searchPayslip) || p.period_end.includes(searchPayslip) || (p.net_pay && p.net_pay.toString().includes(searchPayslip)))
                  .map((p, idx) => {"""
    new_map2 = """                [payslips[0]].map((p, idx) => {"""
    c = c.replace(old_map2, new_map2)

    # Add Modal and render SchedulesTab right before TicketsTab
    render_tickets = "{activeTab === 'tickets' && (\n            <TicketsTab userId={session.user.id} fullName={profile?.full_name || 'Technician'} language={language} isOnline={isOnline} isDarkMode={isDarkMode} />\n          )}"
    
    modal_code = """
            <Modal visible={showPayslipHistory} animationType="slide" transparent={true} onRequestClose={() => setShowPayslipHistory(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: COLORS.background, height: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.textMain }}>{language === 'fil' ? 'Kasaysayan ng Payslip' : 'Payslip History'}</Text>
                    <TouchableOpacity onPress={() => setShowPayslipHistory(false)}>
                      <Feather name="x" size={24} color={COLORS.textMain} />
                    </TouchableOpacity>
                  </View>
                  <TextInput 
                    placeholder={language === 'fil' ? 'Hanapin ang Petsa...' : 'Search Date...'} 
                    placeholderTextColor={COLORS.textMuted}
                    style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border }}
                    value={searchPayslip}
                    onChangeText={setSearchPayslip}
                  />
                  <ScrollView>
                    {payslips.filter(p => p.period_start.includes(searchPayslip) || p.period_end.includes(searchPayslip) || (p.net_pay && p.net_pay.toString().includes(searchPayslip))).map((p, idx) => (
                      <TouchableOpacity key={idx} style={{ padding: 16, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border }} onPress={() => { setShowPayslipHistory(false); setPayslip(p); setShowDisputeModal(true); }}>
                        <Text style={{ fontWeight: 'bold', color: COLORS.textMain }}>{new Date(p.period_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - {new Date(p.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                        <Text style={{ color: COLORS.primary, marginTop: 4 }}>Net Pay: {Number(p.net_pay).toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </Modal>
"""

    render_schedules = """{activeTab === 'schedules' && (
            <SchedulesTab userId={session.user.id} language={language} isOnline={isOnline} />
          )}

          """ + render_tickets

    # Inject modal right after payslip scrollview ends
    c = c.replace("</ScrollView>\n          )}\n\n\n\n          {activeTab === 'tickets'", "</ScrollView>\n" + modal_code + "\n          )}\n\n\n\n          " + render_schedules)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(c)

fix_index('src/app/index.tsx')
