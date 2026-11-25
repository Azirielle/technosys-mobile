import React from 'react';
import { View, Text } from 'react-native';
import { BRAND } from './types';

// Formats inline **bold** and *italic* text segments
export const renderFormattedInline = (text: string, defaultColor: string) => {
  const parts = text.split(/\*\*(.*?)\*\*/g);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <Text key={index} style={{ fontFamily: 'DMSans-Bold', color: defaultColor }}>
          {part}
        </Text>
      );
    }

    const italicParts = part.split(/\*(.*?)\*/g);
    if (italicParts.length > 1) {
      return italicParts.map((iPart, iIdx) => {
        if (iIdx % 2 === 1) {
          return (
            <Text key={`${index}-${iIdx}`} style={{ fontStyle: 'italic', color: defaultColor }}>
              {iPart}
            </Text>
          );
        }
        return <Text key={`${index}-${iIdx}`} style={{ color: defaultColor }}>{iPart}</Text>;
      });
    }

    return <Text key={index} style={{ color: defaultColor }}>{part}</Text>;
  });
};

// Markdown renderer tailored for mobile policy presentation
export const PolicyMarkdownRenderer = ({
  markdown,
  isDark,
  colors,
  title,
}: {
  markdown: string;
  isDark: boolean;
  colors: any;
  title?: string;
}) => {
  if (!markdown) return null;

  // The header already shows the title, so a first "# Title" line that repeats it is skipped.
  const allLines = markdown.split('\n');
  const firstText = allLines.findIndex((l) => l.trim() !== '');
  const lines = allLines.filter(
    (line, i) =>
      !(
        i === firstText &&
        !!title &&
        line.trim().replace(/^#\s+/, '').toLowerCase() === title.trim().toLowerCase()
      )
  );

  return (
    <View style={{ gap: 6 }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (trimmed === '') {
          return <View key={idx} style={{ height: 6 }} />;
        }

        // Divider line (---, ***, ___)
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
          return (
            <View
              key={idx}
              style={{
                height: 1,
                backgroundColor: isDark ? '#334155' : '#E2E8F0',
                marginVertical: 10,
              }}
            />
          );
        }

        // Quote (> ...): shown as a paragraph without the marker
        if (trimmed.startsWith('>')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Regular',
                fontSize: 13,
                color: colors.textMuted,
                lineHeight: 20,
                fontStyle: 'italic',
              }}
            >
              {renderFormattedInline(trimmed.replace(/^>\s*/, ''), colors.textMuted)}
            </Text>
          );
        }

        // Heading 1 (# ...)
        if (trimmed.startsWith('# ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 18,
                color: colors.text,
                marginTop: 14,
                marginBottom: 4,
              }}
            >
              {trimmed.replace(/^#\s+/, '')}
            </Text>
          );
        }

        // Heading 2 (## ...)
        if (trimmed.startsWith('## ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 16,
                color: isDark ? '#60A5FA' : BRAND.accentBlue,
                marginTop: 12,
                marginBottom: 4,
              }}
            >
              {trimmed.replace(/^##\s+/, '')}
            </Text>
          );
        }

        // Heading 3 (### ...)
        if (trimmed.startsWith('### ')) {
          return (
            <Text
              key={idx}
              style={{
                fontFamily: 'DMSans-Bold',
                fontSize: 14,
                color: colors.text,
                marginTop: 8,
                marginBottom: 2,
              }}
            >
              {trimmed.replace(/^###\s+/, '')}
            </Text>
          );
        }

        // Bullet point (- or * )
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.replace(/^[-*]\s+/, '');
          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 4,
                marginVertical: 2,
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: isDark ? '#60A5FA' : BRAND.accentBlue,
                  marginTop: 7,
                  marginRight: 8,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 13,
                  color: colors.text,
                  lineHeight: 19,
                }}
              >
                {renderFormattedInline(content, colors.text)}
              </Text>
            </View>
          );
        }

        // Numbered list (1. 2. etc)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          const num = numMatch[1];
          const content = numMatch[2];
          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 4,
                marginVertical: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: 'DMSans-Bold',
                  fontSize: 12,
                  color: isDark ? '#94A3B8' : '#64748B',
                  width: 20,
                  marginTop: 1,
                }}
              >
                {num}.
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'DMSans-Regular',
                  fontSize: 13,
                  color: colors.text,
                  lineHeight: 19,
                }}
              >
                {renderFormattedInline(content, colors.text)}
              </Text>
            </View>
          );
        }

        // Standard Paragraph
        return (
          <Text
            key={idx}
            style={{
              fontFamily: 'DMSans-Regular',
              fontSize: 13,
              color: colors.text,
              lineHeight: 20,
              marginVertical: 2,
            }}
          >
            {renderFormattedInline(trimmed, colors.text)}
          </Text>
        );
      })}
    </View>
  );
};
