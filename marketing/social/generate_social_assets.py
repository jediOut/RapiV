from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent / "exports"
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = Path(__file__).resolve().parent / "assets"

DOWNLOADS = Path(r"C:\Users\jediv\Downloads")
SCREEN_HOME = DOWNLOADS / "WhatsApp Image 2026-06-19 at 12.22.25 PM.jpeg"
SCREEN_MENU = DOWNLOADS / "WhatsApp Image 2026-06-19 at 12.22.26 PM.jpeg"
SCREEN_COURIER_DELIVERY = DOWNLOADS / "WhatsApp Image 2026-06-17 at 8.59.24 PM.jpeg"
SCREEN_COURIER_PROFILE = DOWNLOADS / "WhatsApp Image 2026-06-17 at 8.59.23 PM.jpeg"
CLIENT_LOGO = ASSETS / "rapiv-cliente-logo.jpeg"
COURIER_LOGO = ASSETS / "rapiv-repartidor-logo.jpeg"
CLIENT_SCREENSHOT = ASSETS / "rapiv-cliente-home.jpeg"
CLIENT_ORDER_SCREENSHOT = ASSETS / "rapiv-cliente-detalle-pedido.jpeg"
COURIER_SCREENSHOT = ASSETS / "rapiv-repartidor-screenshot.png"

TEAL = "#138577"
TEAL_DARK = "#0D635A"
ORANGE = "#EA580C"
ORANGE_DARK = "#C2410C"
ORANGE_LIGHT = "#FFF7ED"
ORANGE_BAND = "#FED7AA"
MINT = "#D9FFF4"
MINT_2 = "#ECFFF8"
INK = "#111827"
MUTED = "#617084"
LINE = "#DCE6E3"
WHITE = "#FFFFFF"
BG = "#F6FAF8"
BLUE = "#2563EB"
BLUE_DARK = "#1D4ED8"
BLUE_LIGHT = "#EFF6FF"
GREEN = "#22C55E"
GREEN_LIGHT = "#F0FDF4"

FONT_DIR = Path(r"C:\Windows\Fonts")


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "regular": ["segoeui.ttf", "arial.ttf"],
        "bold": ["seguisb.ttf", "segoeuib.ttf", "arialbd.ttf"],
        "black": ["seguibl.ttf", "segoeuib.ttf", "arialbd.ttf"],
    }[name]
    for candidate in candidates:
        path = FONT_DIR / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default(size=size)


FONTS = {
    "label": font("bold", 28),
    "body": font("regular", 35),
    "body_bold": font("bold", 35),
    "title": font("black", 74),
    "title_sm": font("black", 62),
    "title_story": font("black", 82),
    "small": font("regular", 27),
    "small_bold": font("bold", 27),
    "chip": font("bold", 26),
}


def rounded_rect(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_wrapped(draw, text, xy, max_width, fill, font_obj, line_gap=8):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = word if not current else f"{current} {word}"
        if draw.textbbox((0, 0), test, font=font_obj)[2] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    x, y = xy
    line_height = font_obj.getbbox("Ag")[3] - font_obj.getbbox("Ag")[1] + line_gap
    for line in lines:
        draw.text((x, y), line, fill=fill, font=font_obj)
        y += line_height
    return y


def paste_rounded(base, image, box, radius=54, shadow=True):
    x, y, w, h = box
    image = image.resize((w, h), Image.Resampling.LANCZOS)

    if shadow:
        shadow_layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow_layer)
        sd.rounded_rectangle((x + 18, y + 24, x + w + 18, y + h + 24), radius=radius, fill=(17, 24, 39, 48))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(22))
        base.alpha_composite(shadow_layer)

    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)

    frame = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle((0, 0, w + 24, h + 24), radius=radius + 18, fill=WHITE, outline=LINE, width=3)
    base.alpha_composite(frame, (x - 12, y - 12))
    base.paste(image, (x, y), mask)


def paste_logo(base, path, x, y, size, radius=None):
    logo = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((0, 0, size, size), radius=radius or size // 5, fill=255)
    base.paste(logo, (x, y), mask)


def crop_app(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    return image.crop((0, 70, width, height - 30))


def crop_real_phone(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    return image.crop((0, 72, width, height - 72))


def crop_client_phone(path):
    image = Image.open(path).convert("RGBA")
    width, height = image.size
    return image.crop((0, 72, width, height - 88))


def draw_brand_mark(draw, x, y, size=64):
    rounded_rect(draw, (x, y, x + size, y + size), size // 4, TEAL)
    awning_y = y + size * 0.32
    draw.rounded_rectangle((x + size * 0.25, awning_y, x + size * 0.75, awning_y + size * 0.19), radius=10, fill=WHITE)
    draw.rectangle((x + size * 0.30, y + size * 0.48, x + size * 0.70, y + size * 0.73), fill=WHITE)
    draw.rectangle((x + size * 0.37, y + size * 0.52, x + size * 0.63, y + size * 0.67), fill=TEAL)


def draw_client_mark(draw, x, y, size=64):
    paste_logo(draw._image, CLIENT_LOGO, x, y, size, radius=size // 5)


def draw_courier_mark(draw, x, y, size=64):
    paste_logo(draw._image, COURIER_LOGO, x, y, size, radius=size // 5)


def draw_header(draw, app_name="RapiV Negocios", light=False):
    draw_brand_mark(draw, 70, 66, 70)
    draw.text((158, 78), app_name, fill=WHITE if light else TEAL_DARK, font=FONTS["label"])


def draw_app_header(draw, app_name, color, mark="store", light=False):
    if mark == "client":
        draw_client_mark(draw, 70, 66, 70)
    elif mark == "courier":
        draw_courier_mark(draw, 70, 66, 70)
    else:
        draw_brand_mark(draw, 70, 66, 70)
    draw.text((158, 78), app_name, fill=WHITE if light else color, font=FONTS["label"])


def draw_chip(draw, x, y, text, fill=MINT_2, outline="#B9F3E6"):
    pad_x = 22
    bbox = draw.textbbox((0, 0), text, font=FONTS["chip"])
    w = bbox[2] - bbox[0] + pad_x * 2
    h = 48
    rounded_rect(draw, (x, y, x + w, y + h), 24, fill, outline=outline, width=2)
    draw.text((x + pad_x, y + 8), text, fill=TEAL_DARK, font=FONTS["chip"])
    return x + w + 12


def draw_centered_text(draw, box, text, fill, font_obj):
    x1, y1, x2, y2 = box
    bbox = draw.textbbox((0, 0), text, font=font_obj)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = x1 + ((x2 - x1) - w) / 2
    y = y1 + ((y2 - y1) - h) / 2 - bbox[1]
    draw.text((x, y), text, fill=fill, font=font_obj)


def save(image, name):
    path = OUT / name
    image.convert("RGB").save(path, quality=95)
    return path


def mock_client_home(width=720, height=1500):
    image = Image.new("RGBA", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    draw.text((54, 60), "RapiV", fill=BLUE_DARK, font=font("black", 42))
    draw.text((54, 116), "Lo local de Vega, mas cerca de ti", fill=MUTED, font=font("regular", 27))
    rounded_rect(draw, (54, 180, width - 54, 258), 32, WHITE, outline="#DCE6F5", width=2)
    draw.text((88, 203), "Buscar comida o negocio", fill="#93A3B8", font=font("regular", 28))
    rounded_rect(draw, (54, 310, width - 54, 500), 38, BLUE, outline=None)
    draw.text((88, 345), "Novedades para ordenar hoy", fill=WHITE, font=font("black", 39))
    draw_wrapped(draw, "Restaurantes, productos y negocios favoritos en un solo lugar.", (88, 405), width - 170, WHITE, font("regular", 26))
    draw.text((54, 560), "Productos populares", fill=INK, font=font("black", 38))
    cards = [
        ("Torta de pastor", "Tacos y tortas Juarez", "$50.00", "#FDE68A"),
        ("Tacos al pastor", "Comida local", "$8.00", "#BBF7D0"),
        ("Producto local", "Negocios de aqui", "$35.00", "#BFDBFE"),
    ]
    y = 625
    for title, subtitle, price, color in cards:
        rounded_rect(draw, (54, y, width - 54, y + 185), 28, WHITE, outline="#E2E8F0", width=2)
        rounded_rect(draw, (82, y + 28, 190, y + 136), 24, color)
        draw.text((220, y + 32), title, fill=INK, font=font("bold", 30))
        draw.text((220, y + 74), subtitle, fill=MUTED, font=font("regular", 25))
        draw.text((220, y + 116), price, fill=BLUE_DARK, font=font("black", 30))
        rounded_rect(draw, (width - 190, y + 62, width - 86, y + 118), 28, GREEN_LIGHT, outline="#BBF7D0", width=2)
        draw.text((width - 160, y + 74), "+", fill=GREEN, font=font("black", 30))
        y += 215
    rounded_rect(draw, (0, height - 120, width, height), 0, WHITE)
    for x, label in [(120, "Inicio"), (310, "Pedidos"), (500, "Carrito")]:
        draw.text((x - 38, height - 66), label, fill=BLUE_DARK if label == "Inicio" else MUTED, font=font("bold", 24))
    return image


def mock_client_cart(width=720, height=1500):
    image = Image.new("RGBA", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    draw.text((54, 70), "Carrito", fill=INK, font=font("black", 54))
    draw.text((54, 150), "Confirma tu pedido y elige entrega", fill=MUTED, font=font("regular", 27))
    rounded_rect(draw, (54, 230, width - 54, 390), 28, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 266), "2 productos", fill=INK, font=font("black", 34))
    draw.text((88, 318), "Torta + tacos al pastor", fill=MUTED, font=font("regular", 27))
    rounded_rect(draw, (54, 430, width - 54, 590), 28, BLUE_LIGHT, outline="#BFDBFE", width=2)
    draw.text((88, 462), "Forma de entrega", fill=INK, font=font("black", 31))
    draw.text((88, 514), "Entrega a domicilio", fill=BLUE_DARK, font=font("bold", 30))
    rounded_rect(draw, (54, 630, width - 54, 780), 28, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 662), "Pago", fill=INK, font=font("black", 31))
    draw.text((88, 714), "Efectivo o tarjeta", fill=MUTED, font=font("regular", 30))
    rounded_rect(draw, (54, 840, width - 54, 1035), 28, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 875), "Resumen", fill=INK, font=font("black", 34))
    for y, label, value in [(938, "Productos", "$66.00"), (990, "Envio", "$30.00")]:
        draw.text((88, y), label, fill=MUTED, font=font("regular", 26))
        draw.text((width - 190, y), value, fill=INK, font=font("bold", 28))
    rounded_rect(draw, (54, 1145, width - 54, 1240), 40, BLUE)
    draw_centered_text(draw, (54, 1145, width - 54, 1240), "Confirmar pedido - $96.00", WHITE, font("bold", 31))
    return image


def mock_courier_deliveries(width=720, height=1500):
    image = Image.new("RGBA", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    draw.text((54, 58), "RAPIV REPARTIDOR", fill=ORANGE_DARK, font=font("black", 28))
    draw.text((54, 105), "Entregas", fill=INK, font=font("black", 58))
    rounded_rect(draw, (54, 210, width - 54, 430), 30, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 245), "Pedido disponible", fill=INK, font=font("black", 34))
    draw.text((88, 298), "Recoger en: negocio local", fill=MUTED, font=font("regular", 26))
    draw.text((88, 338), "Entregar en: zona centro", fill=MUTED, font=font("regular", 26))
    rounded_rect(draw, (width - 245, 280, width - 88, 340), 30, ORANGE_LIGHT, outline=ORANGE_BAND, width=2)
    draw_centered_text(draw, (width - 245, 280, width - 88, 340), "$25.00", ORANGE_DARK, font("black", 27))
    rounded_rect(draw, (54, 475, width - 54, 655), 30, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 510), "Ruta sugerida", fill=INK, font=font("black", 34))
    draw.text((88, 565), "Comercio -> Cliente", fill=MUTED, font=font("regular", 28))
    rounded_rect(draw, (54, 710, width - 54, 885), 30, ORANGE_LIGHT, outline=ORANGE_BAND, width=2)
    draw.text((88, 742), "Pago en efectivo", fill=ORANGE_DARK, font=font("black", 32))
    draw.text((88, 800), "La app muestra monto y cambio", fill=INK, font=font("regular", 27))
    rounded_rect(draw, (54, 1010, width - 54, 1104), 40, ORANGE)
    draw_centered_text(draw, (54, 1010, width - 54, 1104), "Aceptar entrega", WHITE, font("bold", 32))
    rounded_rect(draw, (0, height - 120, width, height), 0, WHITE)
    for x, label in [(125, "Entregas"), (330, "Historial"), (525, "Perfil")]:
        draw.text((x - 48, height - 66), label, fill=ORANGE_DARK if label == "Entregas" else MUTED, font=font("bold", 24))
    return image


def mock_courier_profile(width=720, height=1500):
    image = Image.new("RGBA", (width, height), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    draw.text((54, 58), "RAPIV REPARTIDOR", fill=ORANGE_DARK, font=font("black", 28))
    draw.text((54, 105), "Perfil", fill=INK, font=font("black", 58))
    rounded_rect(draw, (54, 210, width - 54, 350), 30, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 248), "Stripe Connect listo", fill=INK, font=font("black", 31))
    draw.text((88, 295), "Pagos de reparto a tu cuenta", fill=MUTED, font=font("regular", 25))
    stats = [("3", "Activas"), ("12", "Entregadas"), ("$300", "Disponible"), ("$250", "Pagado")]
    x_positions = [54, 370, 54, 370]
    y_positions = [410, 410, 590, 590]
    for (value, label), x, y in zip(stats, x_positions, y_positions):
        rounded_rect(draw, (x, y, x + 295, y + 140), 26, WHITE, outline="#E2E8F0", width=2)
        draw.text((x + 28, y + 26), value, fill=INK, font=font("black", 37))
        draw.text((x + 28, y + 82), label, fill=MUTED, font=font("bold", 24))
    rounded_rect(draw, (54, 805, width - 54, 980), 30, WHITE, outline="#E2E8F0", width=2)
    draw.text((88, 842), "Zonas preferidas", fill=INK, font=font("black", 31))
    draw.text((88, 895), "Recibe pedidos cercanos a tu zona.", fill=MUTED, font=font("regular", 26))
    rounded_rect(draw, (0, height - 120, width, height), 0, WHITE)
    for x, label in [(125, "Entregas"), (330, "Historial"), (525, "Perfil")]:
        draw.text((x - 48, height - 66), label, fill=ORANGE_DARK if label == "Perfil" else MUTED, font=font("bold", 24))
    return image


def sanitized_courier_screen():
    image = crop_real_phone(COURIER_SCREENSHOT)
    width, height = image.size
    draw = ImageDraw.Draw(image)

    card = (32, 330, width - 32, min(1225, height - 145))
    rounded_rect(draw, card, 22, WHITE, outline="#E2E8F0", width=2)
    draw.text((64, 370), "Pedido disponible", fill=INK, font=font("black", 35))
    rounded_rect(draw, (width - 198, 366, width - 64, 422), 28, ORANGE_LIGHT, outline=ORANGE_BAND, width=2)
    draw_centered_text(draw, (width - 198, 366, width - 64, 422), "Nuevo", ORANGE_DARK, font("bold", 24))

    rounded_rect(draw, (64, 470, width - 64, 610), 18, "#F8FAFC", outline="#E2E8F0", width=2)
    draw.text((88, 500), "Pedido de un comercio", fill=INK, font=font("black", 26))
    draw.text((88, 548), "Recoge en el comercio y avanza a la entrega.", fill=MUTED, font=font("regular", 22))

    lines = [
        "Recoger en: negocio local",
        "Entregar en: zona centro",
        "Cliente: pedido de prueba",
        "Total: $210.00",
    ]
    y = 650
    for line in lines:
        draw.text((64, y), line, fill=MUTED if ":" in line else INK, font=font("regular", 26))
        y += 44

    rounded_rect(draw, (64, 850, width - 64, 975), 18, "#F8FAFC", outline="#E2E8F0", width=2)
    draw.text((88, 882), "Pago por entrega", fill=MUTED, font=font("bold", 22))
    draw.text((88, 918), "$25.00", fill=INK, font=font("black", 30))
    rounded_rect(draw, (width - 205, 890, width - 88, 940), 25, "#FEF3C7")
    draw_centered_text(draw, (width - 205, 890, width - 88, 940), "Pendiente", "#92400E", font("bold", 21))

    rounded_rect(draw, (64, 1010, width - 64, 1165), 18, "#FFFBEB", outline="#FDE68A", width=2)
    draw.text((88, 1044), "Pago en efectivo", fill="#92400E", font=font("black", 26))
    draw.text((88, 1094), "Cobra al cliente: $210.00", fill=INK, font=font("bold", 23))
    draw.text((88, 1130), "Se reservara de tu deposito: $185.00", fill=INK, font=font("bold", 23))

    return image


def feed_client_home():
    base = Image.new("RGBA", (1080, 1080), "#F8FBFF")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-180, 745, 620, 1210), radius=220, fill=BLUE_LIGHT)
    draw_app_header(draw, "RapiV Cliente", BLUE_DARK, mark="client")
    title_bottom = draw_wrapped(draw, "Pide en Vega, apoya a Vega", (70, 200), 470, INK, FONTS["title"], line_gap=16)
    body_bottom = draw_wrapped(draw, "Encuentra comida, productos y negocios locales desde tu telefono.", (74, title_bottom + 28), 440, MUTED, FONTS["body"])
    y = body_bottom + 36
    for text in ["Negocios locales", "Pedidos faciles", "Entrega cerca de ti"]:
        draw_chip(draw, 74, y, text, fill=BLUE_LIGHT, outline="#BFDBFE")
        y += 62
    paste_rounded(base, crop_client_phone(CLIENT_SCREENSHOT), (596, 95, 390, 845), radius=58)
    return save(base, "rapiv-cliente-feed-01-pide-local.png")


def feed_client_order():
    base = Image.new("RGBA", (1080, 1080), WHITE)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((560, -210, 1270, 490), radius=260, fill=GREEN_LIGHT)
    draw_app_header(draw, "RapiV Cliente", BLUE_DARK, mark="client")
    title_bottom = draw_wrapped(draw, "Sigue tu pedido hasta la entrega", (70, 197), 480, INK, FONTS["title_sm"], line_gap=14)
    draw_wrapped(draw, "Consulta articulos, total, pago en efectivo y avance del pedido desde la app.", (74, title_bottom + 28), 450, MUTED, FONTS["body"])
    draw_chip(draw, 74, 650, "Pedido entregado")
    draw_chip(draw, 74, 712, "Resumen claro")
    draw_chip(draw, 74, 774, "Pago visible")
    paste_rounded(base, crop_client_phone(CLIENT_ORDER_SCREENSHOT), (588, 95, 392, 845), radius=58)
    return save(base, "rapiv-cliente-feed-02-pedido.png")


def story_client():
    base = Image.new("RGBA", (1080, 1920), "#F8FBFF")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-170, -130, 760, 550), radius=270, fill=BLUE_LIGHT)
    draw_client_mark(draw, 76, 82, 84)
    draw.text((182, 98), "RapiV Cliente", fill=BLUE_DARK, font=FONTS["label"])
    title_bottom = draw_wrapped(draw, "Comida cerca de ti en RapiV", (76, 230), 850, INK, FONTS["title_story"], line_gap=16)
    draw_wrapped(draw, "Explora productos populares y negocios locales desde el inicio.", (82, title_bottom + 30), 820, MUTED, FONTS["body"])
    paste_rounded(base, crop_client_phone(CLIENT_SCREENSHOT), (276, 720, 528, 1093), radius=72)
    return save(base, "rapiv-cliente-story-01-favoritos.png")


def feed_courier_delivery():
    base = Image.new("RGBA", (1080, 1080), "#FFFBF7")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-180, 745, 620, 1210), radius=220, fill=ORANGE_LIGHT)
    draw_app_header(draw, "RapiV Repartidor", ORANGE_DARK, mark="courier")
    title_bottom = draw_wrapped(draw, "Recibe pedidos y genera ingresos", (70, 200), 500, INK, FONTS["title_sm"], line_gap=14)
    body_bottom = draw_wrapped(draw, "Acepta entregas, revisa rutas y controla tus pagos desde una sola app.", (74, title_bottom + 28), 450, MUTED, FONTS["body"])
    y = body_bottom + 36
    for text in ["Entregas", "Rutas", "Pagos visibles"]:
        draw_chip(draw, 74, y, text, fill=ORANGE_LIGHT, outline=ORANGE_BAND)
        y += 62
    paste_rounded(base, sanitized_courier_screen(), (596, 95, 390, 845), radius=58)
    return save(base, "rapiv-repartidor-feed-01-entregas.png")


def feed_courier_profile():
    base = Image.new("RGBA", (1080, 1080), WHITE)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((560, -210, 1270, 490), radius=260, fill=ORANGE_LIGHT)
    draw_app_header(draw, "RapiV Repartidor", ORANGE_DARK, mark="courier")
    title_bottom = draw_wrapped(draw, "Tus entregas y pagos claros", (70, 197), 480, INK, FONTS["title_sm"], line_gap=14)
    draw_wrapped(draw, "Consulta entregas activas, historial, perfil y estado de pagos en RapiV.", (74, title_bottom + 28), 450, MUTED, FONTS["body"])
    draw_chip(draw, 74, 650, "Perfil")
    draw_chip(draw, 74, 712, "Historial")
    draw_chip(draw, 74, 774, "Stripe Connect")
    paste_rounded(base, mock_courier_profile(), (588, 95, 392, 845), radius=58)
    return save(base, "rapiv-repartidor-feed-02-pagos.png")


def story_courier():
    base = Image.new("RGBA", (1080, 1920), "#FFFBF7")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-170, -130, 760, 550), radius=270, fill=ORANGE_LIGHT)
    draw_courier_mark(draw, 76, 82, 84)
    draw.text((182, 98), "RapiV Repartidor", fill=ORANGE_DARK, font=FONTS["label"])
    title_bottom = draw_wrapped(draw, "Conecta con pedidos locales", (76, 230), 850, INK, FONTS["title_story"], line_gap=16)
    draw_wrapped(draw, "Recibe ofertas de entrega y trabaja con negocios de Vega.", (82, title_bottom + 30), 820, MUTED, FONTS["body"])
    paste_rounded(base, sanitized_courier_screen(), (276, 720, 528, 1093), radius=72)
    return save(base, "rapiv-repartidor-story-01-entregas.png")


def feed_business_home():
    base = Image.new("RGBA", (1080, 1080), BG)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-180, 745, 600, 1210), radius=220, fill=MINT_2)
    draw_header(draw)

    title_bottom = draw_wrapped(draw, "Tu negocio listo para vender", (70, 200), 490, INK, FONTS["title"], line_gap=16)
    body_bottom = draw_wrapped(
        draw,
        "Administra pedidos, ventas y tiempos desde una sola app.",
        (74, title_bottom + 28),
        440,
        MUTED,
        FONTS["body"],
    )
    y = body_bottom + 36
    for text in ["Pedidos", "Ventas", "Preparacion", "Disponibilidad"]:
        draw_chip(draw, 74, y, text)
        y += 62
    rounded_rect(draw, (74, 915, 458, 988), 36, TEAL)
    draw.text((110, 932), "Prueba inicial abierta", fill=WHITE, font=FONTS["body_bold"])

    paste_rounded(base, crop_app(SCREEN_HOME), (596, 95, 390, 845), radius=58)
    return save(base, "rapiv-negocios-feed-01-operacion.png")


def feed_menu():
    base = Image.new("RGBA", (1080, 1080), "#FBFEFC")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((560, -210, 1270, 490), radius=260, fill=MINT)
    draw_header(draw)

    title_bottom = draw_wrapped(draw, "Publica tu menu en minutos", (70, 197), 480, INK, FONTS["title_sm"], line_gap=14)
    body_bottom = draw_wrapped(
        draw,
        "Agrega productos, precios, fotos y disponibilidad para que tus clientes puedan pedir.",
        (74, title_bottom + 28),
        450,
        MUTED,
        FONTS["body"],
    )
    chip_y = body_bottom + 34
    draw_chip(draw, 74, chip_y, "Menu editable")
    draw_chip(draw, 74, chip_y + 62, "Visible para clientes")
    draw_chip(draw, 74, chip_y + 124, "Tiempo estimado")

    paste_rounded(base, crop_app(SCREEN_MENU), (588, 95, 392, 845), radius=58)
    return save(base, "rapiv-negocios-feed-02-menu.png")


def feed_feedback():
    base = Image.new("RGBA", (1080, 1080), "#F4FAF8")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((0, 0, 1080, 430), radius=0, fill=TEAL)
    draw_header(draw, "RapiV", light=True)
    draw.text((70, 190), "Negocios de Vega", fill=WHITE, font=FONTS["title_sm"])
    draw_wrapped(draw, "Queremos sus comentarios para mejorar la app antes del lanzamiento completo.", (72, 292), 860, WHITE, FONTS["body"])

    home = crop_app(SCREEN_HOME)
    menu = crop_app(SCREEN_MENU)
    paste_rounded(base, home, (98, 458, 350, 555), radius=48)
    paste_rounded(base, menu, (555, 458, 350, 555), radius=48)

    cta_box = (70, 924, 1010, 1006)
    rounded_rect(draw, cta_box, 41, WHITE, outline="#CBEFE7", width=3)
    draw_centered_text(
        draw,
        cta_box,
        "Si tienes un negocio, mandanos mensaje para participar.",
        TEAL_DARK,
        FONTS["body_bold"],
    )
    return save(base, "rapiv-negocios-feed-03-comentarios.png")


def story_home():
    base = Image.new("RGBA", (1080, 1920), BG)
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((-170, -130, 760, 550), radius=270, fill=MINT)
    draw_brand_mark(draw, 76, 82, 84)
    draw.text((182, 98), "RapiV Negocios", fill=TEAL_DARK, font=FONTS["label"])
    title_bottom = draw_wrapped(draw, "Controla tu operacion desde el telefono", (76, 230), 840, INK, FONTS["title_story"], line_gap=16)
    draw_wrapped(
        draw,
        "Pedidos, ventas, tiempos de preparacion y disponibilidad en una sola pantalla.",
        (82, title_bottom + 30),
        820,
        MUTED,
        FONTS["body"],
    )
    paste_rounded(base, crop_app(SCREEN_HOME), (276, 720, 528, 1093), radius=72)
    return save(base, "rapiv-negocios-story-01-operacion.png")


def story_menu():
    base = Image.new("RGBA", (1080, 1920), "#FBFEFC")
    draw = ImageDraw.Draw(base)
    draw.rounded_rectangle((480, -120, 1220, 580), radius=260, fill=MINT_2)
    draw_brand_mark(draw, 76, 82, 84)
    draw.text((182, 98), "RapiV Negocios", fill=TEAL_DARK, font=FONTS["label"])
    title_bottom = draw_wrapped(draw, "Tu menu visible para clientes", (76, 230), 820, INK, FONTS["title_story"], line_gap=16)
    draw_wrapped(
        draw,
        "Agrega productos, define precios y cambia disponibilidad cuando lo necesites.",
        (82, title_bottom + 30),
        820,
        MUTED,
        FONTS["body"],
    )
    paste_rounded(base, crop_app(SCREEN_MENU), (276, 720, 528, 1093), radius=72)
    return save(base, "rapiv-negocios-story-02-menu.png")


def main():
    paths = [
        feed_business_home(),
        feed_menu(),
        feed_feedback(),
        story_home(),
        story_menu(),
        feed_client_home(),
        feed_client_order(),
        story_client(),
        feed_courier_delivery(),
        feed_courier_profile(),
        story_courier(),
    ]
    for path in paths:
        image = Image.open(path)
        print(f"{path.name}: {image.size[0]}x{image.size[1]}")


if __name__ == "__main__":
    main()
