import AVFoundation
import Foundation

class CameraFaceScanProvider: NSObject, FaceScanProvider, AVCapturePhotoCaptureDelegate {
    let session = AVCaptureSession()
    let mode: CaptureMode
    private let queue = DispatchQueue(label: "smartskin.capture")
    private let output = AVCapturePhotoOutput()
    private var configured = false
    private var pending: CheckedContinuation<NativePhoto, Error>?
    init(mode: CaptureMode = .camera) { self.mode = mode; super.init() }
    var isAvailable: Bool { device != nil }
    private var device: AVCaptureDevice? {
        AVCaptureDevice.default(mode == .trueDepth ? .builtInTrueDepthCamera : .builtInWideAngleCamera, for: .video, position: .front)
    }
    func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
        default: return false
        }
    }
    func start() async throws {
        guard await requestAccess() else { throw FaceScanError.permissionDenied }
        try Task.checkCancellation()
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async {
                do {
                    if !self.configured {
                        guard let device = self.device else { throw FaceScanError.deviceUnavailable }
                        self.session.beginConfiguration()
                        do {
                            self.session.sessionPreset = .photo
                            let input = try AVCaptureDeviceInput(device: device)
                            guard self.session.canAddInput(input), self.session.canAddOutput(self.output) else { throw FaceScanError.deviceUnavailable }
                            self.session.addInput(input); self.session.addOutput(self.output)
                            if self.mode == .trueDepth {
                                guard self.output.isDepthDataDeliverySupported else { throw FaceScanError.deviceUnavailable }
                                self.output.isDepthDataDeliveryEnabled = true
                            }
                            self.session.commitConfiguration(); self.configured = true
                        } catch { self.session.commitConfiguration(); throw error }
                    }
                    if !self.session.isRunning { self.session.startRunning() }
                    continuation.resume()
                } catch { continuation.resume(throwing: error) }
            }
        }
    }
    func capturePhoto() async throws -> NativePhoto {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                guard self.session.isRunning, self.pending == nil else {
                    continuation.resume(throwing: FaceScanError.captureFailed("The camera is not ready.")); return
                }
                self.pending = continuation
                let settings = AVCapturePhotoSettings(format: [AVVideoCodecKey: AVVideoCodecType.jpeg])
                if self.mode == .trueDepth {
                    settings.isDepthDataDeliveryEnabled = self.output.isDepthDataDeliveryEnabled
                    settings.embedsDepthDataInPhoto = false
                }
                if let connection = self.output.connection(with: .video), connection.isVideoOrientationSupported { connection.videoOrientation = .portrait }
                self.output.capturePhoto(with: settings, delegate: self)
            }
        }
    }
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        queue.async {
            guard let continuation = self.pending else { return }
            self.pending = nil
            if let error = error { continuation.resume(throwing: error); return }
            do { continuation.resume(returning: try PhotoAnalysis.analyze(photo)) }
            catch { continuation.resume(throwing: error) }
        }
    }
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishCaptureFor resolvedSettings: AVCaptureResolvedPhotoSettings, error: Error?) {
        guard let error = error else { return }
        queue.async { self.pending?.resume(throwing: error); self.pending = nil }
    }
    func stop() {
        queue.async {
            self.pending?.resume(throwing: CancellationError()); self.pending = nil
            if self.session.isRunning { self.session.stopRunning() }
        }
    }
}
