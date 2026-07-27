import sys
import os

file_path = 'c:\\Users\\ANDREW\\.gemini\\antigravity\\scratch\\hris-mobile\\src\\app\\index.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Imports
imports = """import { usePushNotifications } from '../hooks/usePushNotifications';
import { CopilotProvider, CopilotStep, walkthroughable, useCopilot } from 'react-native-copilot';

const CopilotView = walkthroughable(View);
const CopilotTouchableOpacity = walkthroughable(TouchableOpacity);
"""
if 'useCopilot' not in content:
    content = content.replace("import * as Sharing from 'expo-sharing';", "import * as Sharing from 'expo-sharing';\n" + imports)

# 2. Add App Wrapper
app_func_target = """export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);"""

app_func_replacement = """export default function App() {
  return (
    <CopilotProvider stopOnOutsideClick androidStatusBarVisible>
      <MainAppContent />
    </CopilotProvider>
  );
}

function MainAppContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { start: startCopilot, copilotEvents } = useCopilot();
  const pushNotificationState = usePushNotifications();"""

if 'function MainAppContent' not in content:
    content = content.replace(app_func_target, app_func_replacement)

# 3. Add Tutorial Alert Logic
hook_target = """  useEffect(() => {
    activeAppLanguage = language;
  }, [language]);"""

hook_replacement = hook_target + """

  useEffect(() => {
    const checkCopilot = async () => {
      const neverShow = await AsyncStorage.getItem('COPILOT_NEVER_SHOW');
      if (neverShow !== 'true' && session) {
        setTimeout(() => {
          Alert.alert(
            language === 'fil' ? 'Mabilis na Tour' : 'Quick Tour',
            language === 'fil' ? 'Gusto mo bang kumuha ng mabilis na tour sa app?' : 'Would you like a quick tour of the app features?',
            [
              { text: language === 'fil' ? 'Simulan' : 'Start Tour', onPress: () => startCopilot() },
              { text: language === 'fil' ? 'Laktawan' : 'Skip', style: 'cancel' },
              { text: language === 'fil' ? 'Huwag nang ipaalala' : 'Never remind me again', style: 'destructive', onPress: () => AsyncStorage.setItem('COPILOT_NEVER_SHOW', 'true') }
            ]
          );
        }, 1500);
      }
    };
    checkCopilot();
  }, [session, language]);"""

if 'COPILOT_NEVER_SHOW' not in content:
    content = content.replace(hook_target, hook_replacement)

# 4. Wrap elements in CopilotStep
announcement_target = """              {/* Premium Styled Announcements Section */}
              <View style={{ marginBottom: 24 }}>
                {(() => {"""
announcement_replacement = """              {/* Premium Styled Announcements Section */}
              <CopilotStep text="Latest company news and updates will appear here." order={1} name="announcements">
              <CopilotView style={{ marginBottom: 24 }}>
                {(() => {"""
content = content.replace(announcement_target, announcement_replacement)

announcement_close_target = """                })()}
              </View>

              {/* Attendance Flow - Dynamic Action Card */}"""
announcement_close_replacement = """                })()}
              </CopilotView>
              </CopilotStep>

              {/* Attendance Flow - Dynamic Action Card */}"""
content = content.replace(announcement_close_target, announcement_close_replacement)


attendance_target = """              {/* Attendance Flow - Dynamic Action Card */}
              <View style={{ marginHorizontal: 20, marginBottom: 24 }}>"""
attendance_replacement = """              {/* Attendance Flow - Dynamic Action Card */}
              <CopilotStep text="Clock in here when you're within 50 meters of your assigned office." order={2} name="attendance">
              <CopilotView style={{ marginHorizontal: 20, marginBottom: 24 }}>"""
content = content.replace(attendance_target, attendance_replacement)

attendance_close_target = """                  </View>
                )}
              </View>

              {/* Priority Dispatch Section */}"""
attendance_close_replacement = """                  </View>
                )}
              </CopilotView>
              </CopilotStep>

              {/* Priority Dispatch Section */}"""
content = content.replace(attendance_close_target, attendance_close_replacement)


dispatch_target = """              {/* Priority Dispatch Section */}
              <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>"""
dispatch_replacement = """              {/* Priority Dispatch Section */}
              <CopilotStep text="Check if you have any urgent dispatch tasks from admins here." order={3} name="dispatch">
              <CopilotView style={{ marginHorizontal: 20, marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>"""
content = content.replace(dispatch_target, dispatch_replacement)

dispatch_close_target = """                  </ScrollView>
                ) : (
                  <View style={styles.emptyCard}>
                    <Feather name="check-circle" size={32} color={COLORS.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <Text style={{ fontSize: 16, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 }}>
                      {language === 'fil' ? 'Walang Dispatch' : 'No Dispatch Assigned'}
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>
                      {language === 'fil' 
                        ? 'Wala kang nakatalagang priority dispatch sa ngayon.' 
                        : 'You have no priority dispatch assigned right now.'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Standard Schedule Section */}"""
dispatch_close_replacement = """                  </ScrollView>
                ) : (
                  <View style={styles.emptyCard}>
                    <Feather name="check-circle" size={32} color={COLORS.textMuted} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <Text style={{ fontSize: 16, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 }}>
                      {language === 'fil' ? 'Walang Dispatch' : 'No Dispatch Assigned'}
                    </Text>
                    <Text style={{ fontSize: 13, color: COLORS.textMuted, textAlign: 'center' }}>
                      {language === 'fil' 
                        ? 'Wala kang nakatalagang priority dispatch sa ngayon.' 
                        : 'You have no priority dispatch assigned right now.'}
                    </Text>
                  </View>
                )}
              </CopilotView>
              </CopilotStep>

              {/* Standard Schedule Section */}"""
content = content.replace(dispatch_close_target, dispatch_close_replacement)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
