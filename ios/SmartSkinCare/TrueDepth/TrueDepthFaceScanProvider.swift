import AVFoundation

/// Public AVFoundation depth capture; raw depth maps never leave the device.
final class TrueDepthFaceScanProvider: CameraFaceScanProvider {
    init() { super.init(mode: .trueDepth) }
}
