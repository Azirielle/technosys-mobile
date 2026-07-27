import os

def fix_layout():
    path = "src/app/_layout.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace("BackHandler.removeEventListener('hardwareBackPress', onBackPress);", "const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);\n      return () => subscription.remove();")
    # Clean up the double addEventListener if it occurs
    content = content.replace("BackHandler.addEventListener('hardwareBackPress', onBackPress);\n      return () =>\nconst subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);\n      return () => subscription.remove();", "const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);\n      return () => subscription.remove();")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_index():
    path = "src/app/index.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Add loginMethod state if missing
    if "const [loginMethod" not in content:
        content = content.replace("const [session, setSession] = useState<any>(null);", "const [session, setSession] = useState<any>(null);\n  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def fix_tickets():
    path = "src/components/TicketsTab.tsx"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    # Fix string/number comparison
    content = content.replace("item.urgency >=", "Number(item.urgency) >=")
    content = content.replace("item.urgency >", "Number(item.urgency) >")
    content = content.replace("item.urgency ===", "Number(item.urgency) ===")
    content = content.replace("item.urgency ==", "Number(item.urgency) ==")
    content = content.replace("a.urgency - b.urgency", "Number(a.urgency) - Number(b.urgency)")
    content = content.replace("b.urgency - a.urgency", "Number(b.urgency) - Number(a.urgency)")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    fix_layout()
    fix_index()
    fix_tickets()
    print("TypeScript errors patched.")
