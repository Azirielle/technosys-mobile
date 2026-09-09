import os
from PIL import Image, ImageDraw, ImageFont

def generate_assets():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_dir = os.path.join(base_dir, 'assets', 'images')
    logo_path = os.path.join(assets_dir, 'technocycle_logo.png')
    trans_logo_path = os.path.join(assets_dir, 'technocycle_logo_transparent.png')

    if not os.path.exists(trans_logo_path):
        import collections
        img = Image.open(logo_path).convert('RGBA')
        w, h = img.size
        pixels = img.load()
        visited = set()
        queue = collections.deque([(0, 0), (w-1, 0), (0, h-1), (w-1, h-1)])
        for pt in list(queue):
            visited.add(pt)
        while queue:
            x, y = queue.popleft()
            r, g, b, a = pixels[x, y]
            if r > 240 and g > 240 and b > 240:
                pixels[x, y] = (r, g, b, 0)
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        nr, ng, nb, _ = pixels[nx, ny]
                        if nr > 235 and ng > 235 and nb > 235:
                            queue.append((nx, ny))
        img.save(trans_logo_path)

    orig = Image.open(trans_logo_path)
    bbox = orig.getbbox()
    emblem = orig.crop(bbox)

    # 1. SPLASH ICON (Lockup: Emblem + 'TECHNOCYCLE' + 'FIELD OPERATIONS')
    canvas_w, canvas_h = 600, 680
    splash = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 0))

    target_emblem_w = 380
    ratio = target_emblem_w / emblem.width
    target_emblem_h = int(emblem.height * ratio)
    emblem_resized = emblem.resize((target_emblem_w, target_emblem_h), Image.Resampling.LANCZOS)

    emblem_x = (canvas_w - target_emblem_w) // 2
    emblem_y = 30
    splash.paste(emblem_resized, (emblem_x, emblem_y), emblem_resized)

    draw = ImageDraw.Draw(splash)
    font_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 48)
    font_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 19)

    title_text = 'TECHNOCYCLE'
    sub_text = 'FIELD OPERATIONS'

    t_bbox = draw.textbbox((0, 0), title_text, font=font_title)
    t_w = t_bbox[2] - t_bbox[0]
    t_x = (canvas_w - t_w) // 2
    t_y = emblem_y + target_emblem_h + 24
    draw.text((t_x, t_y), title_text, fill=(15, 23, 42, 255), font=font_title)

    spaced_sub = '  '.join(list(sub_text))
    s_bbox = draw.textbbox((0, 0), spaced_sub, font=font_sub)
    s_w = s_bbox[2] - s_bbox[0]
    s_x = (canvas_w - s_w) // 2
    s_y = t_y + 58
    draw.text((s_x, s_y), spaced_sub, fill=(100, 116, 139, 255), font=font_sub)

    pad = 20
    s_bbox = splash.getbbox()
    splash_cropped = splash.crop((max(0, s_bbox[0]-pad), max(0, s_bbox[1]-pad), min(canvas_w, s_bbox[2]+pad), min(canvas_h, s_bbox[3]+pad)))
    splash_cropped.save(os.path.join(assets_dir, 'splash-icon.png'))
    print('1. Generated splash-icon.png:', splash_cropped.size)

    # 2. ANDROID ADAPTIVE FOREGROUND (432x432)
    fg_size = 432
    fg = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 0))
    fg_emblem_w = 260
    fg_ratio = fg_emblem_w / emblem.width
    fg_emblem_h = int(emblem.height * fg_ratio)
    fg_emblem = emblem.resize((fg_emblem_w, fg_emblem_h), Image.Resampling.LANCZOS)
    fg.paste(fg_emblem, ((fg_size - fg_emblem_w) // 2, (fg_size - fg_emblem_h) // 2), fg_emblem)
    fg.save(os.path.join(assets_dir, 'android-icon-foreground.png'))
    print('2. Generated android-icon-foreground.png:', fg.size)

    # 3. ANDROID ADAPTIVE BACKGROUND (432x432)
    bg = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 255))
    bg.save(os.path.join(assets_dir, 'android-icon-background.png'))
    print('3. Generated android-icon-background.png:', bg.size)

    # 4. MASTER ICON (1024x1024)
    icon_size = 1024
    master_icon = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 255))
    m_emblem_w = 720
    m_ratio = m_emblem_w / emblem.width
    m_emblem_h = int(emblem.height * m_ratio)
    m_emblem = emblem.resize((m_emblem_w, m_emblem_h), Image.Resampling.LANCZOS)
    master_icon.paste(m_emblem, ((icon_size - m_emblem_w) // 2, (icon_size - m_emblem_h) // 2), m_emblem)

    # 5. HEADER LOGO (512x512)
    logo_img = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
    w = 480
    ratio = w / emblem.width
    h = int(emblem.height * ratio)
    resized = emblem.resize((w, h), Image.Resampling.LANCZOS)
    logo_img.paste(resized, ((512 - w) // 2, (512 - h) // 2), resized)
    logo_img.save(os.path.join(base_dir, 'assets', 'logo.png'))
    print('5. Generated assets/logo.png:', logo_img.size)

if __name__ == '__main__':
    generate_assets()

