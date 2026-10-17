// Renders public/og-wallcovering-fire-ratings.jpg, the fire-ratings page share card, in the site's own colours and fonts.
// swiftc -O scripts/og/fire-ratings-card.swift -o /tmp/card && /tmp/card node_modules public/og-wallcovering-fire-ratings.jpg

import AppKit
import CoreText

let args = CommandLine.arguments
let nm = args[1] // node_modules path
let out = args[2]
func font(_ file: String, _ size: CGFloat) -> NSFont {
  let data = try! Data(contentsOf: URL(fileURLWithPath: "\(nm)/@fontsource/\(file)")) as CFData
  guard let descs = CTFontManagerCreateFontDescriptorsFromData(data) as? [CTFontDescriptor], let d = descs.first else { fatalError("cannot read \(file)") }
  return CTFontCreateWithFontDescriptor(d, size, nil) as NSFont
}
func hex(_ h: UInt32) -> NSColor { NSColor(srgbRed: CGFloat((h >> 16) & 0xff) / 255, green: CGFloat((h >> 8) & 0xff) / 255, blue: CGFloat(h & 0xff) / 255, alpha: 1) }
let ivory = hex(0xf4f0e8), ink = hex(0x141210), brass = hex(0x6b542f), stone = hex(0x4e4942), line = hex(0xddd6c8), gold = hex(0xc6a36a)
let W: CGFloat = 1200, H: CGFloat = 630
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(W), pixelsHigh: Int(H), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
ivory.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
// inner frame
line.setStroke(); let frame = NSBezierPath(rect: NSRect(x: 40, y: 40, width: W - 80, height: H - 80)); frame.lineWidth = 2; frame.stroke()
func drawTop(_ s: String, _ f: NSFont, _ c: NSColor, x: CGFloat, top: CGFloat, kern: CGFloat = 0, right: Bool = false) {
  let a = NSAttributedString(string: s, attributes: [.font: f, .foregroundColor: c, .kern: kern])
  let size = a.size()
  a.draw(at: NSPoint(x: right ? x - size.width : x, y: H - top - size.height))
}
let eyebrow = font("outfit/files/outfit-latin-500-normal.woff2", 22)
let title = font("cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", 96)
let sub = font("cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", 42)
let foot = font("outfit/files/outfit-latin-500-normal.woff2", 20)
let foot2 = font("outfit/files/outfit-latin-400-normal.woff2", 20)
drawTop("THE WALLCOVERING GUIDE", eyebrow, brass, x: 96, top: 112, kern: 4)
gold.setFill(); NSRect(x: 96, y: H - 160, width: 64, height: 3).fill()
drawTop("Wallcovering Fire Ratings", title, ink, x: 92, top: 188)
drawTop("British standards and commercial specification", sub, stone, x: 96, top: 318)
line.setFill(); NSRect(x: 96, y: H - 500, width: W - 192, height: 1).fill()
drawTop("MR WALLCOVER", foot, ink, x: 96, top: 524, kern: 4)
drawTop("mrwallcover.com", foot2, stone, x: W - 96, top: 524, right: true)
NSGraphicsContext.restoreGraphicsState()
let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.88])!
try! jpeg.write(to: URL(fileURLWithPath: out))
print("wrote \(out) \(jpeg.count) bytes")
