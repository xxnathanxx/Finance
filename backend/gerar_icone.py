"""
Gera o ícone do Órbita: fundo em quadrado arredondado com gradiente
laranja -> rosa (cores quentes e vivas, combinação análoga bem
avaliada em ícones modernos), um planeta com leve gradiente radial
("soft 3D" sutil, sem ilustração pesada) e um único anel dourado
passando por trás e pela frente do planeta pra dar profundidade, com
uma sombra suave por baixo do conjunto.

Rodar uma vez pra gerar o arquivo; não faz parte do app em si.
"""
from __future__ import annotations

import math

from PIL import Image, ImageDraw, ImageFilter

TAMANHOS = [16, 24, 32, 48, 64, 128, 256]

COR_FUNDO_A = (255, 130, 68, 255)   # laranja vivo
COR_FUNDO_B = (233, 30, 99, 255)    # rosa/magenta vivo
COR_PLANETA_CLARO = (255, 255, 255, 255)
COR_PLANETA_ESCURO = (255, 214, 214, 255)
COR_ANEL = (255, 205, 60, 255)      # dourado vivo


def gradiente_diagonal(tamanho: int, cor_a, cor_b) -> Image.Image:
    base = Image.new("RGBA", (tamanho, tamanho))
    px = base.load()
    for y in range(tamanho):
        for x in range(tamanho):
            t = (x + y) / (2 * tamanho)
            r = int(cor_a[0] + (cor_b[0] - cor_a[0]) * t)
            g = int(cor_a[1] + (cor_b[1] - cor_a[1]) * t)
            b = int(cor_a[2] + (cor_b[2] - cor_a[2]) * t)
            px[x, y] = (r, g, b, 255)
    return base


def mascara_quadrado_arredondado(tamanho: int, raio_relativo: float = 0.24) -> Image.Image:
    escala = 4  # desenha maior e reduz depois, pra ficar com borda suave
    grande = tamanho * escala
    raio = int(grande * raio_relativo)
    mascara = Image.new("L", (grande, grande), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, grande - 1, grande - 1], radius=raio, fill=255)
    return mascara.resize((tamanho, tamanho), Image.LANCZOS)


def disco_com_gradiente_radial(diametro: int, cor_clara, cor_escura, deslocamento=0.32) -> Image.Image:
    """Círculo com luz vindo do canto superior-esquerdo (efeito soft-3D sutil)."""
    img = Image.new("RGBA", (diametro, diametro), (0, 0, 0, 0))
    px = img.load()
    cx = diametro * (0.5 - deslocamento * 0.5)
    cy = diametro * (0.5 - deslocamento * 0.5)
    raio_max = diametro * 0.82
    for y in range(diametro):
        for x in range(diametro):
            dist = math.hypot(x - diametro / 2, y - diametro / 2)
            if dist > diametro / 2:
                continue
            t = min(1.0, math.hypot(x - cx, y - cy) / raio_max)
            r = int(cor_clara[0] + (cor_escura[0] - cor_clara[0]) * t)
            g = int(cor_clara[1] + (cor_escura[1] - cor_clara[1]) * t)
            b = int(cor_clara[2] + (cor_escura[2] - cor_clara[2]) * t)
            px[x, y] = (r, g, b, 255)
    return img


def gerar_base(tamanho_render: int = 512) -> Image.Image:
    fundo = gradiente_diagonal(tamanho_render, COR_FUNDO_A, COR_FUNDO_B)
    mascara = mascara_quadrado_arredondado(tamanho_render)

    img = Image.new("RGBA", (tamanho_render, tamanho_render), (0, 0, 0, 0))
    img.paste(fundo, (0, 0), mascara)

    centro = tamanho_render / 2
    angulo_anel = -22

    raio_planeta = tamanho_render * 0.205
    largura_anel = tamanho_render * 0.64
    altura_anel = tamanho_render * 0.205
    espessura = max(2, round(tamanho_render * 0.048))

    def desenhar_anel() -> Image.Image:
        camada = Image.new("RGBA", (tamanho_render, tamanho_render), (0, 0, 0, 0))
        d = ImageDraw.Draw(camada)
        d.ellipse(
            [
                centro - largura_anel / 2,
                centro - altura_anel / 2,
                centro + largura_anel / 2,
                centro + altura_anel / 2,
            ],
            outline=COR_ANEL,
            width=espessura,
        )
        return camada.rotate(angulo_anel, resample=Image.BICUBIC, center=(centro, centro))

    # sombra suave por baixo do conjunto planeta+anel, pra dar leve profundidade
    sombra = Image.new("RGBA", (tamanho_render, tamanho_render), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).ellipse(
        [
            centro - raio_planeta * 1.35,
            centro - raio_planeta * 0.55 + tamanho_render * 0.06,
            centro + raio_planeta * 1.35,
            centro + raio_planeta * 1.15 + tamanho_render * 0.06,
        ],
        fill=(80, 10, 30, 90),
    )
    sombra = sombra.filter(ImageFilter.GaussianBlur(tamanho_render * 0.02))
    img.alpha_composite(sombra)

    # 1) anel inteiro (fica "atrás" do planeta)
    img.alpha_composite(desenhar_anel())

    # 2) planeta com leve gradiente radial, cobrindo a parte de trás do anel
    planeta = disco_com_gradiente_radial(int(raio_planeta * 2), COR_PLANETA_CLARO, COR_PLANETA_ESCURO)
    img.alpha_composite(planeta, (int(centro - raio_planeta), int(centro - raio_planeta)))

    # 3) recorta só a metade de baixo do anel e desenha de novo por cima
    #    do planeta, simulando a parte da frente
    anel_frente_completo = desenhar_anel()
    mascara_frente = Image.new("L", (tamanho_render, tamanho_render), 0)
    ImageDraw.Draw(mascara_frente).rectangle(
        [0, centro, tamanho_render, tamanho_render], fill=255
    )
    anel_frente = Image.new("RGBA", (tamanho_render, tamanho_render), (0, 0, 0, 0))
    anel_frente.paste(anel_frente_completo, (0, 0), mascara_frente)
    img.alpha_composite(anel_frente)

    return img


if __name__ == "__main__":
    base = gerar_base(512)
    imagens = [base.resize((t, t), Image.LANCZOS) for t in TAMANHOS]
    imagens[-1].save(
        "assets/icone.ico",
        format="ICO",
        sizes=[(t, t) for t in TAMANHOS],
    )
    print("icone gerado em assets/icone.ico")
