from PIL import Image

def pad_icon():
    img = Image.open('assets/icon.png').convert("RGBA")
    orig_size = img.size[0]
    new_size = int(orig_size / 0.6)
    background = Image.new('RGBA', (new_size, new_size), (0, 0, 0, 0))
    offset = ((new_size - orig_size) // 2, (new_size - orig_size) // 2)
    background.paste(img, offset, img)
    background.save('assets/icon.png')
    print("Icon padded successfully!")

if __name__ == '__main__':
    pad_icon()
