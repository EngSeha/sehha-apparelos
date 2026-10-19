# Independent check of the synthetic geometry prototype with a third-party DXF reader (ezdxf) and the Python XML parser.
# Usage: python -I verify_with_ezdxf.py <dir containing SYN-APRON-01.{dxf,svg,manifest.json}>
import sys, json, xml.etree.ElementTree as ET
import ezdxf
d = sys.argv[1]; man = json.load(open(f"{d}/SYN-APRON-01.manifest.json"))
doc = ezdxf.readfile(f"{d}/SYN-APRON-01.dxf"); msp = doc.modelspace()
res = {"ezdxf": ezdxf.__version__, "dxfversion": doc.dxfversion, "insunits": doc.header.get("$INSUNITS")}
def area(p):
    return abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p))))/2
polys = [e for e in msp if e.dxftype() == "POLYLINE"]
cut = [[(v.dxf.location.x, v.dxf.location.y) for v in e.vertices] for e in polys if e.dxf.layer == "CUT"]
sew = [[(v.dxf.location.x, v.dxf.location.y) for v in e.vertices] for e in polys if e.dxf.layer == "SEW"]
res["closed_all"] = all(e.is_closed for e in polys); res["cut"] = len(cut); res["sew"] = len(sew)
checks = []
for pc, c, s in zip(man["pieces"], cut, sew):
    xs = [x for x, _ in c]; ys = [y for _, y in c]
    checks.append({"piece": pc["code"], "cutW": round(max(xs)-min(xs), 3), "cutH": round(max(ys)-min(ys), 3), "cutArea": round(area(c), 1), "sewArea": round(area(s), 1),
                   "matchesManifest": abs(max(xs)-min(xs)-pc["cutWidthMm"]) < 0.01 and abs(max(ys)-min(ys)-pc["cutHeightMm"]) < 0.01 and abs(area(c)-pc["cutAreaMm2"]) < 1 and abs(area(s)-pc["sewAreaMm2"]) < 1})
res["pieces"] = checks
svg = ET.parse(f"{d}/SYN-APRON-01.svg").getroot(); vb = svg.get("viewBox").split()
res["svg_mm_1to1"] = svg.get("width") == vb[2] + "mm" and svg.get("height") == vb[3] + "mm"; res["svg_cut_ready"] = svg.get("data-cut-ready")
res["PASS"] = res["insunits"] == 4 and res["closed_all"] and res["cut"] == 3 and res["sew"] == 3 and all(c["matchesManifest"] for c in checks) and res["svg_mm_1to1"] and res["svg_cut_ready"] == "false"
print(json.dumps(res, indent=1)); sys.exit(0 if res["PASS"] else 1)
