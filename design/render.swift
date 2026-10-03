import AppKit

func rgb(_ hex: UInt32) -> NSColor {
  NSColor(srgbRed: CGFloat((hex >> 16) & 0xff)/255, green: CGFloat((hex >> 8) & 0xff)/255, blue: CGFloat(hex & 0xff)/255, alpha: 1)
}

func render(_ name: String, size: CGFloat, draw: (CGFloat) -> Void) {
  let img = NSImage(size: NSSize(width: size, height: size))
  img.lockFocus()
  draw(size)
  img.unlockFocus()
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  rep.size = NSSize(width: size, height: size)
  let png = rep.representation(using: .png, properties: [:])!
  try! png.write(to: URL(fileURLWithPath: name))
}

func roundedBg(_ s: CGFloat, _ color: NSColor) {
  color.setFill()
  NSBezierPath(roundedRect: NSRect(x: 0, y: 0, width: s, height: s), xRadius: s * 0.22, yRadius: s * 0.22).fill()
}

func text(_ str: String, _ s: CGFloat, fontSize: CGFloat, weight: NSFont.Weight, color: NSColor, dy: CGFloat = 0, dx: CGFloat = 0) {
  let font = NSFont.systemFont(ofSize: fontSize, weight: weight)
  let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .kern: -fontSize * 0.04]
  let a = NSAttributedString(string: str, attributes: attrs)
  let sz = a.size()
  a.draw(at: NSPoint(x: (s - sz.width) / 2 + dx, y: (s - sz.height) / 2 + dy))
}

func chevrons(_ s: CGFloat, color: NSColor, y: CGFloat, inset: CGFloat, width: CGFloat) {
  color.setStroke()
  let p = NSBezierPath(); p.lineWidth = width; p.lineCapStyle = .round; p.lineJoinStyle = .round
  let h = s * 0.09
  // left chevron pointing out
  p.move(to: NSPoint(x: inset + h, y: y + h)); p.line(to: NSPoint(x: inset, y: y)); p.line(to: NSPoint(x: inset + h, y: y - h))
  // right chevron pointing out
  p.move(to: NSPoint(x: s - inset - h, y: y + h)); p.line(to: NSPoint(x: s - inset, y: y)); p.line(to: NSPoint(x: s - inset - h, y: y - h))
  p.stroke()
}

let blue = rgb(0x1D9BF0), dim = rgb(0x15202B), white = NSColor.white, ink = rgb(0x0F1419)

for size in [128.0, 512.0] as [CGFloat] {
  let tag = Int(size)
  // A: blue tile, bold white "eX"
  render("A-blue-eX-\(tag).png", size: size) { s in
    roundedBg(s, blue)
    text("eX", s, fontSize: s * 0.62, weight: .heavy, color: white, dy: s * 0.02)
  }
  // B: dim tile, white "eX", blue chevrons flanking
  render("B-dim-eX-chevrons-\(tag).png", size: size) { s in
    roundedBg(s, dim)
    text("eX", s, fontSize: s * 0.5, weight: .heavy, color: white, dy: s * 0.02)
    chevrons(s, color: blue, y: s * 0.5, inset: s * 0.1, width: s * 0.06)
  }
  // C: white tile, ink "eX", blue chevrons
  render("C-white-eX-chevrons-\(tag).png", size: size) { s in
    roundedBg(s, white)
    text("eX", s, fontSize: s * 0.5, weight: .heavy, color: ink, dy: s * 0.02)
    chevrons(s, color: blue, y: s * 0.5, inset: s * 0.1, width: s * 0.06)
  }
  // D: blue tile, a narrow column widening (bars + chevrons), no letters
  render("D-blue-column-\(tag).png", size: size) { s in
    roundedBg(s, blue)
    white.setFill()
    let col = NSRect(x: s * 0.36, y: s * 0.22, width: s * 0.28, height: s * 0.56)
    NSBezierPath(roundedRect: col, xRadius: s * 0.04, yRadius: s * 0.04).fill()
    chevrons(s, color: white, y: s * 0.5, inset: s * 0.12, width: s * 0.07)
  }
}
print("rendered")
