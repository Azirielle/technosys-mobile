import re

file_path = "src/app/index.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add state variable
if "const [showPayslipDetailsModal" not in content:
    content = content.replace(
        "const [showDisputeModal, setShowDisputeModal] = useState(false);",
        "const [showDisputeModal, setShowDisputeModal] = useState(false);\n  const [showPayslipDetailsModal, setShowPayslipDetailsModal] = useState(false);"
    )

# 2. Add BackHandler logic
if "setShowPayslipDetailsModal(false);" not in content:
    content = content.replace(
        "if (showDisputeModal) {\n        setShowDisputeModal(false);\n        return true;\n      }",
        "if (showPayslipDetailsModal) {\n        setShowPayslipDetailsModal(false);\n        return true;\n      }\n      if (showDisputeModal) {\n        setShowDisputeModal(false);\n        return true;\n      }"
    )
    content = content.replace(
        "showDisputeModal, activeTab",
        "showPayslipDetailsModal, showDisputeModal, activeTab"
    )
    content = content.replace(
        "setShowDisputeModal(false);\n                      setSelectedAnnouncement(null);",
        "setShowPayslipDetailsModal(false);\n                      setShowDisputeModal(false);\n                      setSelectedAnnouncement(null);"
    )

# 3. Replace the payslip rendering block
# We will find the start of `const payslip = p;` and the end at `</View>\n                  );`
# and replace the whole thing.

start_marker = "const payslip = p;"
end_marker = "</View>\n                  );"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    # The end marker might have spaces. Let's find the first `);` after `I-dispute ang Payslip`
    dispute_marker = "I-dispute ang Payslip"
    if dispute_marker in content[start_idx:]:
        dispute_idx = content.find(dispute_marker, start_idx)
        view_close_idx = content.find("</View>", dispute_idx)
        end_idx = content.find(";", view_close_idx) + 1 # include the semicolon
        
        replacement = """const payslip = p;
                    const cycleLogs = dtrLogs.filter(log => {
                      const logDate = log.created_at ? log.created_at.split('T')[0] : '';
                      return logDate >= payslip.period_start && logDate <= payslip.period_end;
                    });
                    const daysWorked = cycleLogs.length || 10;
                    const totalHours = cycleLogs.reduce((sum, log) => sum + Number(log.total_hours || 0), 0) || (daysWorked * 8);
                    
                    const baseHourlyRate = Number(profile?.base_salary || 20000) / 208;
                    const expectedRegularPay = baseHourlyRate * totalHours;
                    const holidayBonus = Math.max(0, Number(payslip.gross_pay) - expectedRegularPay);
                    const holidayHours = holidayBonus > 0 ? Math.round(holidayBonus / (baseHourlyRate * 0.3)) : 0;
                    
                    const withholdingTax = Math.max(0, Number(payslip.gross_pay) - Number(payslip.sss_deduction) - Number(payslip.philhealth_deduction) - Number(payslip.pagibig_deduction) - Number(payslip.net_pay));

                    return (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.payslipCard}
                        onPress={() => {
                          setPayslip(payslip);
                          setShowPayslipDetailsModal(true);
                        }}
                      >
                        <Text style={styles.sectionTitle}>{language === 'fil' ? 'Huling Payslip' : 'Payslip Record'}</Text>
                        <Text style={styles.period}>{language === 'fil' ? 'Siklo' : 'Cycle'}: {payslip.period_start} to {payslip.period_end}</Text>
                        
                        <View style={[styles.netPayBox, { marginBottom: 0 }]}>
                          <Text style={styles.netPayLabel}>{language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}</Text>
                          <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                        </View>
                        <View style={{ marginTop: 16, alignItems: 'center' }}>
                          <Text style={{ color: COLORS.primary, fontWeight: 'bold' }}>{language === 'fil' ? 'Tingnan ang Detalye' : 'View Full Details'} &rarr;</Text>
                        </View>
                      </TouchableOpacity>
                    );"""
        content = content[:start_idx] + replacement + content[end_idx:]

# 4. Add the Payslip Details Modal
modal_code = """
      {showPayslipDetailsModal && payslip && (
        <Modal animationType="slide" transparent={false} visible={showPayslipDetailsModal} onRequestClose={() => setShowPayslipDetailsModal(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <TouchableOpacity onPress={() => setShowPayslipDetailsModal(false)} style={{ padding: 8, marginLeft: -8 }}>
                <Feather name="arrow-left" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.textMain }}>{language === 'fil' ? 'Detalye ng Payslip' : 'Payslip Details'}</Text>
              <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.payslipCard}>
                <Text style={styles.sectionTitle}>{language === 'fil' ? 'Huling Payslip' : 'Payslip Record'}</Text>
                <Text style={styles.period}>{language === 'fil' ? 'Siklo' : 'Cycle'}: {payslip.period_start} to {payslip.period_end}</Text>
                
                <View style={styles.netPayBox}>
                  <Text style={styles.netPayLabel}>{language === 'fil' ? 'Kabuuang Netong Sahod' : 'Net Take-Home Pay'}</Text>
                  <Text style={styles.netPayAmount}>{formatPhp(payslip.net_pay)}</Text>
                </View>

                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 8 }}>
                  {language === 'fil' ? 'PAGHAHATI-HATI NG KITA' : 'EARNINGS BREAKDOWN'}
                </Text>
                
                <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Base Regular Pay' : 'Base Regular Pay'}</Text>
                    <Text style={{ color: COLORS.textMain, fontWeight: '600', fontSize: 13 }}>{formatPhp(Math.min(Number(payslip.gross_pay), (Number(profile?.base_salary || 20000) / 208) * 80))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Oras ng Holiday at Bonus' : 'Holiday Hours & Multiplier'}</Text>
                    <Text style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: 13 }}>+{formatPhp(Math.max(0, Number(payslip.gross_pay) - ((Number(profile?.base_salary || 20000) / 208) * 80)))}</Text>
                  </View>
                </View>

                <Text style={{ color: COLORS.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  {language === 'fil' ? 'MGA BINAWAS (DEDUCTIONS)' : 'DEDUCTIONS & ADJUSTMENTS'}
                </Text>

                <View style={{ backgroundColor: '#ffffff', borderRadius: 16, borderLeftWidth: 0, borderRightWidth: 0, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>SSS Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.sss_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>PhilHealth Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.philhealth_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>Pag-IBIG Contribution</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(payslip.pagibig_deduction)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{language === 'fil' ? 'Withholding Tax / Karagdagang Bawas' : 'Withholding Tax adjustments'}</Text>
                    <Text style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: 13 }}>- {formatPhp(Math.max(0, Number(payslip.gross_pay) - Number(payslip.sss_deduction) - Number(payslip.philhealth_deduction) - Number(payslip.pagibig_deduction) - Number(payslip.net_pay)))}</Text>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={() => {
                      setShowPayslipDetailsModal(false);
                      setTimeout(() => setShowDisputeModal(true), 300);
                  }}
                  style={{ backgroundColor: COLORS.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 12 }}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                    {language === 'fil' ? 'I-dispute ang Payslip' : 'Dispute Payslip'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
"""

if "showPayslipDetailsModal && payslip" not in content:
    dispute_modal_marker = "{showDisputeModal && ("
    if dispute_modal_marker in content:
        content = content.replace(dispute_modal_marker, modal_code + "\n      " + dispute_modal_marker)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Payslip UI updated successfully!")
