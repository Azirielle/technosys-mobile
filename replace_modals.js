const fs = require('fs');
let content = fs.readFileSync('src/app/(tabs)/index.tsx', 'utf8');

content = content.replace(/import\s+\{([^}]*)Modal([^}]*)\}\s+from\s+'react-native';/, (match, p1, p2) => {
    let clean = (p1 + p2).replace(/,\s*,/g, ',').replace(/\{\s*,/g, '{').replace(/,\s*\}/g, '}');
    return `import {${clean}} from 'react-native';`;
});

if (!content.includes("import RNModal from 'react-native-modal';")) {
    content = content.replace(/import \{ View,/, "import RNModal from 'react-native-modal';\nimport { View,");
}

content = content.replace(/<Modal\s+([^>]*)visible=\{([^}]+)\}([^>]*)onRequestClose=\{([^}]+)\}([^>]*)>/g, (match, p1, p2, p3, p4, p5) => {
    return `<RNModal ${p1}isVisible={${p2}}${p3}onBackdropPress={${p4}} onSwipeComplete={${p4}} swipeDirection={['down']} propagateSwipe={true} swipeThreshold={50} style={{ margin: 0, justifyContent: 'flex-end' }}${p5}>`;
});

content = content.replace(/animationType="[^"]*"/g, '');
content = content.replace(/transparent=\{true\}/g, '');
content = content.replace(/transparent=\{false\}/g, '');

content = content.replace(/<\/Modal>/g, '</RNModal>');

fs.writeFileSync('src/app/(tabs)/index.tsx', content);
console.log("Successfully replaced Modals");
