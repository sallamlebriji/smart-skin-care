import Vision
import UIKit
import AVFoundation

enum PhotoAnalysis {
    static func analyze(_ photo: AVCapturePhoto) throws -> NativePhoto {
        guard let data = photo.fileDataRepresentation(), let original = UIImage(data: data) else {
            throw FaceScanError.captureFailed("The camera did not return a readable photo.")
        }
        // Normalize EXIF rotation before Vision analysis and server upload.
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        let scale = min(1, 1280 / max(original.size.width, original.size.height))
        let size = CGSize(width: original.size.width * scale, height: original.size.height * scale)
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            original.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let jpeg = image.jpegData(compressionQuality: 0.9), let cgImage = image.cgImage else {
            throw FaceScanError.captureFailed("Photo conversion failed.")
        }
        let request = VNDetectFaceLandmarksRequest()
        try VNImageRequestHandler(cgImage: cgImage, orientation: .up).perform([request])
        guard let faces = request.results, faces.count == 1, let face = faces.first else {
            throw FaceScanError.captureFailed("Keep exactly one face visible and try again.")
        }
        let rectangle = face.boundingBox
        let landmarks = face.landmarks?.allPoints?.normalizedPoints.map {
            CGPoint(x: rectangle.minX + CGFloat($0.x) * rectangle.width,
                    y: rectangle.minY + CGFloat($0.y) * rectangle.height)
        } ?? []
        let light = brightness(cgImage)
        guard light.luma > 0.15 && light.luma < 0.90 && light.imbalance < 0.18 else {
            throw FaceScanError.captureFailed("Use softer, more even lighting and retake this angle.")
        }
        let area = rectangle.width * rectangle.height
        guard area > 0.06 && area < 0.80 else {
            throw FaceScanError.captureFailed("Adjust the distance so your whole face fills the center of the frame.")
        }
        guard let yaw = face.yaw else {
            throw FaceScanError.captureFailed("Face angle could not be estimated. Look toward the camera and retry.")
        }
        return NativePhoto(jpeg: jpeg, image: image, luma: light.luma, imbalance: light.imbalance, yaw: yaw.doubleValue,
                           landmarks: landmarks, faceArea: Double(area), depthMeters: depthDistance(photo.depthData))
    }

    private static func brightness(_ image: CGImage) -> (luma: Double, imbalance: Double) {
        var pixels = [UInt8](repeating: 0, count: 32 * 32)
        let valid = pixels.withUnsafeMutableBytes { storage -> Bool in
            guard let context = CGContext(data: storage.baseAddress, width: 32, height: 32,
                bitsPerComponent: 8, bytesPerRow: 32, space: CGColorSpaceCreateDeviceGray(), bitmapInfo: 0) else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: 32, height: 32)); return true
        }
        guard valid else { return (0, 1) }
        let luma = Double(pixels.reduce(0) { $0 + Int($1) }) / Double(pixels.count * 255)
        var left = 0, right = 0
        for y in 0..<32 { for x in 0..<32 { if x < 16 { left += Int(pixels[y * 32 + x]) } else { right += Int(pixels[y * 32 + x]) } } }
        return (luma, Double(abs(left - right)) / Double(512 * 255))
    }

    private static func depthDistance(_ depth: AVDepthData?) -> Double? {
        guard let depth = depth else { return nil }
        let map = depth.converting(toDepthDataType: kCVPixelFormatType_DepthFloat32).depthDataMap
        CVPixelBufferLockBaseAddress(map, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(map, .readOnly) }
        guard let address = CVPixelBufferGetBaseAddress(map) else { return nil }
        let values = address.assumingMemoryBound(to: Float.self)
        let stride = CVPixelBufferGetBytesPerRow(map) / MemoryLayout<Float>.size
        let width = CVPixelBufferGetWidth(map), height = CVPixelBufferGetHeight(map)
        var samples: [Float] = []
        for y in (height / 3)..<(height * 2 / 3) {
            for x in (width / 3)..<(width * 2 / 3) {
                let value = values[y * stride + x]
                if value.isFinite && value > 0 && value < 2 { samples.append(value) }
            }
        }
        guard !samples.isEmpty else { return nil }
        samples.sort(); return Double(samples[samples.count / 2])
    }
}
