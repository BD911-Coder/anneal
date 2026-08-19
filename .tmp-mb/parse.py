import io, re, sys, html

FORM = {"ATX": "ATX", "mATX": "mATX", "Micro-ATX": "mATX", "ITX": "ITX",
        "Mini-ITX": "ITX", "E-ATX": "E-ATX", "EATX": "E-ATX"}


def duzMetin(path):
    s = io.open(path, encoding="utf-8", errors="replace").read()
    t = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t)


def specs(path):
    t = duzMetin(path)
    d = {}

    m = re.search(r"Socket (AM\d)", t)
    if m:
        d["socket"] = m.group(1)
    else:
        m = re.search(r"LGA (\d{4})", t)
        if m:
            d["socket"] = "LGA" + m.group(1)

    m = re.search(r"Chipset\s+(?:AMD|INTEL|Intel)\S*\s+([A-Z]\d{3}E?)", t)
    if m:
        d["chipset"] = m.group(1)

    m = re.search(r"PCB Info (E-ATX|EATX|Micro-ATX|mATX|Mini-ITX|ITX|ATX)", t)
    if m:
        d["form_factor"] = FORM[m.group(1)]

    m = re.search(r"Memory (\d+)x (DDR\d)", t)
    if m:
        d["memory_slots"] = m.group(1)
        d["memory_type"] = m.group(2)

    m = re.search(r"Maximum Memory Capacity (\d+)\s*GB", t)
    if m:
        d["max_memory_gb"] = m.group(1)

    # "Memory Support DDR5 8400 - 5600 (OC)" ya da "Memory Support 9200 - 6400 (OC)"
    m = re.search(r"Memory Support (?:DDR\d )?(\d{4,5})", t)
    if m:
        d["max_memory_speed_mhz"] = m.group(1)

    m = re.search(r"Storage (\d+)x M\.2", t)
    if m:
        d["m2_slots"] = m.group(1)

    return d


ALANLAR = ["socket", "chipset", "form_factor", "memory_type", "memory_slots",
           "max_memory_gb", "max_memory_speed_mhz", "m2_slots"]

print(f"{'dosya':28}" + "".join(f"{a[:9]:>10}" for a in ALANLAR))
for path in sys.argv[1:]:
    d = specs(path)
    ad = path.split("/")[-1].replace(".html", "")
    eksik = [a for a in ALANLAR if a not in d]
    isaret = "" if not eksik else "  << EKSIK: " + ",".join(eksik)
    print(f"{ad:28}" + "".join(f"{d.get(a, '-'):>10}" for a in ALANLAR) + isaret)
