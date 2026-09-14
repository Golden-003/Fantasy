"""Figure 1 — Classement reel de la ligue (apres J4, 13 sept 2026)."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
import matplotlib.pyplot as plt

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Donnees reelles (capture utilisateur, 13/09/2026 21:02, apres la journee 4)
equipes = ["Zarés JR", "Vital_GDB", "Aziza FC", "Donatien Lokossou530", "nik Leroy"]
totaux  = [283, 284, 295, 318, 333]
pts_j4  = [78, 71, 65, 83, 108]
# Emphase : accent sur l'equipe de l'utilisateur (Vital_GDB), gris pour les autres
ACCENT = "#D4875A"
GRIS = "#B0B0B0"
couleurs = [GRIS, ACCENT, GRIS, GRIS, GRIS]

fig, ax = plt.subplots(figsize=(10, 5), constrained_layout=True)
bars = ax.barh(equipes, totaux, color=couleurs, height=0.62, zorder=3)
# Points de la J4 en marqueur secondaire
ax.scatter(pts_j4, equipes, color="#1A2330", s=42, zorder=4, label="Points de la journée 4")

for bar, total, j4 in zip(bars, totaux, pts_j4):
    ax.text(bar.get_width() + 3, bar.get_y() + bar.get_height()/2,
            f"{total}", va="center", ha="left", fontsize=11, color="#1A2330", fontweight="bold")

ax.set_xlim(0, 380)
ax.set_xlabel("Total de points (après 4 journées)", fontsize=11)
ax.set_title("Ligue « Le fond de la classe » — Classement réel au 13 septembre 2026", fontsize=12.5, fontweight="bold", color="#1A2330")
ax.grid(True, axis="x", alpha=0.3, zorder=0)
ax.spines[["top", "right"]].set_visible(False)
ax.tick_params(axis="y", labelsize=11)
ax.legend(loc="lower right", fontsize=9.5, frameon=True)

out = "/home/z/my-project/scripts/chart_ligue.png"
plt.savefig(out, dpi=200)
print("saved", out)
