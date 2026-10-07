import AVFoundation
import Foundation

protocol FaceScanProvider: AnyObject {
    var session: AVCaptureSession { get }
    var mode: CaptureMode { get }
    var isAvailable: Bool { get }
    func requestAccess() async -> Bool
    func start() async throws
    func capturePhoto() async throws -> NativePhoto
    func stop()
}
enum FaceScanError: LocalizedError {
    case permissionDenied, deviceUnavailable
    case captureFailed(String)
    var errorDescription: String? {
        switch self {
        case .permissionDenied: return "Camera access is required. Enable it in iPhone Settings."
        case .deviceUnavailable: return "This capture mode is unavailable. Try the standard camera."
        case .captureFailed(let message): return message
        }
    }
}
