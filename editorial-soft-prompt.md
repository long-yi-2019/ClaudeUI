STYLEKIT_STYLE_REFERENCE
style_name: 编辑杂志风
style_slug: editorial
style_source: /styles/editorial

# Soft Prompt

保持整体风格气质即可，允许实现细节灵活调整，但不要偏离核心视觉语言。

## Style Signals
- 杂志排版
- 衬线字体
- 优雅留白
- 网格系统
- 极简主义
- 作品集

## Prefer
- 标题使用衬线字体 font-serif，正文使用无衬线字体 font-sans
- 背景使用暖米色 bg-[#F9F8F6]，文字使用柔和黑 text-[#1C1C1C]
- 使用透明度层次构建灰度：text-[#1C1C1C]/60（次要）、/40（辅助）、/10（边框）
- 标签样式使用 font-sans text-xs tracking-[0.2em] uppercase

## Avoid
- 禁止使用彩色强调色（红、蓝、绿等），保持纯单色体系
- 禁止使用粗边框或阴影（shadow-*）
- 禁止使用 #0a0a0a 纯黑或 #fafafa 冷白作为主色

## Output Guidance
- 先保证整体风格识别度，再优化细节。
- 避免过度炫技，保持可读性与可维护性。