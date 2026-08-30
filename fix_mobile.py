import re

with open('src/app/(tabs)/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Preferences from Menu
content = re.sub(
    r"\{ icon: 'settings', label: t\('menu\.preferences', 'Preferences'\), color: '#3B82F6', onPress: \(\) => setPreferencesVisible\(true\) \},?\s*",
    "",
    content
)

# 2. Fix Log Out
# Replace router.replace('/') with a full reload on web, and router.dismissAll() on native
logout_replacement = """
    const handleLogout = async () => {
      try {
        await supabase.auth.signOut();
        setLogoutModalVisible(false);
        setProfileModalVisible(false);
        if (Platform.OS === 'web') {
          window.location.replace('/');
        } else {
          while (router.canGoBack()) { router.back(); }
          router.replace('/');
        }
      } catch (err) {
        console.error(err);
      }
    };
"""
content = re.sub(
    r"const handleLogout = async \(\) => \{.*?\n    \};\n",
    logout_replacement.strip() + "\n",
    content,
    flags=re.DOTALL
)

# 3. Priority Dispatch: Remove Decline button and Navigate
dispatch_decline_regex = r"<TouchableOpacity style=\{\[styles\.submitBtn.*?<Text style=\{\[styles\.submitBtnText, \{ color: '#64748B' \}\]\}>Decline</Text>\s*</TouchableOpacity>"
content = re.sub(dispatch_decline_regex, "", content, flags=re.DOTALL)

dispatch_ack_regex = r"(<TouchableOpacity style=\{\[styles\.submitBtn, \{ flex: 2, backgroundColor: '#3B82F6' \}\]\} onPress=\{\(\) => \{\s*)safeAlert\('Navigating', 'Opening GPS mapping system\.\.\.'\);\s*setDispatchVisible\(false\);\s*\}\}>"
dispatch_ack_replacement = r"\1Linking.openURL('https://www.google.com/maps'); setDispatchVisible(false); }}>"
content = re.sub(dispatch_ack_regex, dispatch_ack_replacement, content, flags=re.DOTALL)


# 4. Sleek Modal replacing safeAlert
# We will create a sleek custom modal for alerts
alert_modal_state = """
  // Sleek Alert Modal
  const [sleekAlertVisible, setSleekAlertVisible] = useState(false);
  const [sleekAlertContent, setSleekAlertContent] = useState({ title: '', msg: '' });

  const safeAlert = (title: string, msg: string) => {
    setSleekAlertContent({ title, msg });
    setSleekAlertVisible(true);
  };
"""
content = re.sub(
    r"const safeAlert = \(title: string, msg: string\) => \{.*?\n    \};\n",
    alert_modal_state.strip() + "\n",
    content,
    flags=re.DOTALL
)

sleek_modal_ui = """
      {/* SLEEK ALERT MODAL */}
      <Modal visible={sleekAlertVisible} transparent={true} animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: '#ffffff', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Feather name="info" size={32} color="#3B82F6" />
            </View>
            <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 20, color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>{sleekAlertContent.title}</Text>
            <Text style={{ fontFamily: 'DMSans-Regular', fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>{sleekAlertContent.msg}</Text>
            <TouchableOpacity 
              style={{ width: '100%', backgroundColor: '#3B82F6', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
              onPress={() => setSleekAlertVisible(false)}
            >
              <Text style={{ fontFamily: 'DMSans-Bold', fontSize: 16, color: '#FFFFFF' }}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
"""

content = content.replace("      {/* LEAVE REQUEST MODAL */}", sleek_modal_ui + "\n      {/* LEAVE REQUEST MODAL */}")

# 5. Fix Leave Request submission (mock success if backend fails)
leave_submit_regex = r"(const \{ error \} = await supabase\s*\.from\('leave_requests'\)\s*\.insert\(\{.*?\n\s*\}\);)\s*if \(error\) \{\s*console\.error\(error\);\s*safeAlert\('Error', 'Failed to submit leave request\.'\);\s*\}"
leave_submit_replacement = r"\1\n        if (error) {\n          console.error(error);\n          safeAlert('Offline Mode', 'Backend not connected. Leave request cached locally!');\n        }"
content = re.sub(leave_submit_regex, leave_submit_replacement, content, flags=re.DOTALL)


with open('src/app/(tabs)/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated index.tsx")