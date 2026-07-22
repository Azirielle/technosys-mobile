import os
import re

def add_payslip_history(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the TextInput block
    search_input_pattern = r"<\s*TextInput[\s\S]*?onChangeText=\{setSearchPayslip\}[\s\S]*?/>"
    
    # Replace the TextInput with a Button + Latest Payslip Logic
    replacement = """<TouchableOpacity onPress={() => setShowPayslipHistory(true)} style={{ backgroundColor: COLORS.border, padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: COLORS.textMain, fontWeight: 'bold' }}>{language === 'fil' ? 'Tingnan ang Kasaysayan' : 'View Payslip History'}</Text>
              </TouchableOpacity>
"""
    content = re.sub(search_input_pattern, replacement, content, count=1)

    # Now modify the map to only show the first payslip, and add the modal
    map_start_pattern = r"payslips\s*\n\s*\.filter[\s\S]*?\.map\(\(p, idx\) => \{"
    map_replacement = """[payslips[0]].map((p, idx) => {"""
    content = re.sub(map_start_pattern, map_replacement, content, count=1)

    # Finally, insert the Modal at the end of the Payslip Tab
    modal_insert_pattern = r"(</ScrollView>\s*)}\s*\n\s*{\s*activeTab === 'tickets'"
    modal_ui = """</ScrollView>
            
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
          )}

          {activeTab === 'tickets'"""
    
    content = re.sub(modal_insert_pattern, modal_ui, content, count=1)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

add_payslip_history('src/app/index.tsx')
