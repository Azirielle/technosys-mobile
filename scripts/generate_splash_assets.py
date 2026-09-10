import os
from PIL import Image, ImageFilter
import numpy as np

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
    emblem_tight = orig.crop(bbox)

    # 1. ANDROID 12+ CIRCULAR SAFE-ZONE NATIVE SPLASH (512x512)
    native_splash = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
    target_dim = 300
    ratio = target_dim / max(emblem_tight.width, emblem_tight.height)
    emblem_scaled = emblem_tight.resize((int(emblem_tight.width * ratio), int(emblem_tight.height * ratio)), Image.Resampling.LANCZOS)
    px = (512 - emblem_scaled.width) // 2
    py = (512 - emblem_scaled.height) // 2
    native_splash.paste(emblem_scaled, (px, py), emblem_scaled)
    native_splash.save(os.path.join(assets_dir, 'splash-icon.png'))
    print('1. Generated Android 12+ safe-zone 1:1 splash-icon.png:', native_splash.size)

    # 2. 5 EMBLEM ANIMATION LAYERS (Normalized on 600x600 canvas)
    arr = np.array(orig)
    r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
    visible = a > 50

    blue_mask = visible & (b > 100) & (r < 60)
    green_mask = visible & (g > 90) & (r < 60) & (b < 80)
    yellow_mask = visible & (r > 180) & (g > 160) & (b < 80)
    red_mask = visible & (r > 120) & (g < 60) & (b < 70)

    def dilate_mask(m, radius=7):
        p_img = Image.fromarray((m * 255).astype(np.uint8))
        dilated = p_img.filter(ImageFilter.MaxFilter(radius))
        return np.array(dilated) > 128

    dil_blue = dilate_mask(blue_mask, 7)
    dil_green = dilate_mask(green_mask, 7)
    dil_yellow = dilate_mask(yellow_mask, 7)
    dil_red = dilate_mask(red_mask, 7)
    all_arrows = dil_blue | dil_green | dil_yellow | dil_red
    center_mask = visible & (~all_arrows)

    layers = {
        'arrow_blue.png': dil_blue & visible,
        'arrow_red.png': dil_red & visible,
        'arrow_yellow.png': dil_yellow & visible,
        'arrow_green.png': dil_green & visible,
        'center_gear.png': center_mask & visible
    }

    out_dir = os.path.join(assets_dir, 'emblem_parts')
    os.makedirs(out_dir, exist_ok=True)

    for name, m in layers.items():
        part = np.zeros_like(arr)
        part[m] = arr[m]
        p_img = Image.fromarray(part)
        p_cropped = p_img.crop(bbox)
        
        c_size = 600
        c_img = Image.new('RGBA', (c_size, c_size), (255, 255, 255, 0))
        s_dim = 520
        s_ratio = s_dim / max(emblem_tight.width, emblem_tight.height)
        p_scaled = p_cropped.resize((int(p_cropped.width * s_ratio), int(p_cropped.height * s_ratio)), Image.Resampling.LANCZOS)
        c_img.paste(p_scaled, ((c_size - p_scaled.width) // 2, (c_size - p_scaled.height) // 2), p_scaled)
        c_img.save(os.path.join(out_dir, name))
        print(f'2. Saved animation layer {name}')

    # 3. ANDROID ADAPTIVE FOREGROUND (432x432)
    fg_size = 432
    fg = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 0))
    fg_emblem_w = 260
    fg_ratio = fg_emblem_w / emblem_tight.width
    fg_emblem_h = int(emblem_tight.height * fg_ratio)
    fg_emblem = emblem_tight.resize((fg_emblem_w, fg_emblem_h), Image.Resampling.LANCZOS)
    fg.paste(fg_emblem, ((fg_size - fg_emblem_w) // 2, (fg_size - fg_emblem_h) // 2), fg_emblem)
    fg.save(os.path.join(assets_dir, 'android-icon-foreground.png'))
    print('3. Generated android-icon-foreground.png:', fg.size)

    # 4. ANDROID ADAPTIVE BACKGROUND (432x432)
    bg = Image.new('RGBA', (fg_size, fg_size), (255, 255, 255, 255))
    bg.save(os.path.join(assets_dir, 'android-icon-background.png'))
    print('4. Generated android-icon-background.png:', bg.size)

    # 5. MASTER ICON (1024x1024)
    icon_size = 1024
    master_icon = Image.new('RGBA', (icon_size, icon_size), (255, 255, 255, 255))
    m_emblem_w = 720
    m_ratio = m_emblem_w / emblem_tight.width
    m_emblem_h = int(emblem_tight.height * m_ratio)
    m_emblem = emblem_tight.resize((m_emblem_w, m_emblem_h), Image.Resampling.LANCZOS)
    master_icon.paste(m_emblem, ((icon_size - m_emblem_w) // 2, (icon_size - m_emblem_h) // 2), m_emblem)
    master_icon.save(os.path.join(assets_dir, 'icon.png'))
    master_icon.save(os.path.join(assets_dir, 'technosys_mobile.png'))
    master_icon.save(os.path.join(assets_dir, 'favicon.png'))
    print('5. Generated master icon assets:', master_icon.size)

    # 6. HEADER LOGO (512x512)
    logo_img = Image.new('RGBA', (512, 512), (255, 255, 255, 0))
    w = 480
    ratio = w / emblem_tight.width
    h = int(emblem_tight.height * ratio)
    resized = emblem_tight.resize((w, h), Image.Resampling.LANCZOS)
    logo_img.paste(resized, ((512 - w) // 2, (512 - h) // 2), resized)
    logo_img.save(os.path.join(base_dir, 'assets', 'logo.png'))
    print('6. Generated assets/logo.png:', logo_img.size)

if __name__ == '__main__':
    generate_assets()
