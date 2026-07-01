import ezdxf, collections
doc = ezdxf.readfile(r'data_source\VWITS-HUDON PUNE_6TH FLOOR.dxf')
msp = doc.modelspace()
counts = collections.Counter()
for e in msp:
    counts[(e.dxf.layer, e.dxftype())] += 1
print(f"{'LAYER':<35} {'TYPE':<15} COUNT")
print('-'*60)
for (layer, typ), n in sorted(counts.items(), key=lambda kv: (kv[0][0], -kv[1])):
    print(f"{layer:<35} {typ:<15} {n}")
