import SwiftUI

struct NativeScanView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    @Environment(\.scenePhase) private var scenePhase
    @State private var mode = CaptureMode.camera
    @State private var provider = CameraFaceScanProvider()
    @State private var photos: [String: NativePhoto] = [:]
    @State private var ready = false
    @State private var working = false
    @State private var consent = false
    @State private var visible = false
    @State private var error: String?
    @State private var uploaded: ScanRecord?
    @State private var operation: Task<Void, Never>?
    private let angles = ["front", "left", "right"]
    private var angle: String { angles.first { photos[$0] == nil } ?? "right" }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    Picker("Capture mode", selection: $mode) {
                        Text("Camera").tag(CaptureMode.camera)
                        Text("TrueDepth").tag(CaptureMode.trueDepth)
                    }.pickerStyle(.segmented).disabled(working || workspace.busy)
                    if uploaded == nil {
                        CameraPreview(session: provider.session).frame(height: 340).clipShape(RoundedRectangle(cornerRadius: 24))
                        Text(photos.count == 3 ? "Three angles captured" : instruction).font(.title3).bold()
                        Text("Use even lighting, remove glasses, and keep one face centered. Capture guidance uses first-pass heuristics.").font(.caption)
                        HStack {
                            ForEach(angles, id: \.self) { value in
                                VStack {
                                    if let photo = photos[value] { Image(uiImage: photo.image).resizable().scaledToFill().frame(width: 80, height: 90).clipped() }
                                    Text(value.capitalized).font(.caption)
                                }
                            }
                        }
                        if let distance = photos["front"]?.depthMeters { Text("Depth capture available · approximately \(distance, specifier: "%.2f") m").font(.caption) }
                        if photos.count < 3 {
                            Button(working ? "Capturing…" : "Capture \(angle)") { capture() }.buttonStyle(.borderedProminent).disabled(!ready || working)
                        } else {
                            Toggle("I agree to send these three photos to the configured server for a visual assessment.", isOn: $consent)
                            Text(workspace.endpoint).font(.caption)
                            Button(working ? "Uploading…" : "Upload scan") { upload() }.buttonStyle(.borderedProminent).disabled(!consent || working)
                            Button("Retake all angles") { photos = [:]; consent = false; error = nil }.disabled(working)
                        }
                    } else if let scan = uploaded {
                        Label("Scan saved to your account", systemImage: "checkmark.circle")
                        Text("Open History to run analysis. Depth is used for local capture guidance only; the server analyzes the color photograph.").font(.caption)
                        Button("Start another scan") { uploaded = nil; photos = [:]; consent = false; launchCamera() }
                        Text("Scan reference: \(scan.id)").font(.caption)
                    }
                    if !ready && uploaded == nil && !working { Button("Retry camera") { launchCamera() } }
                    if let error = error { Text(error).foregroundStyle(.red) }
                    Text("Visual assessment, not a diagnosis. No raw depth maps are uploaded.").font(.caption)
                }.padding()
            }.navigationTitle("Face capture")
                .onAppear { visible = true; if uploaded == nil { launchCamera() } }
                .onDisappear { visible = false; operation?.cancel(); provider.stop(); ready = false }
                .onChange(of: mode) { _ in photos = [:]; consent = false; uploaded = nil; launchCamera() }
                .onChange(of: scenePhase) { phase in
                    if phase != .active { operation?.cancel(); provider.stop(); ready = false }
                    else if visible && uploaded == nil { launchCamera() }
                }
        }
    }
    private var instruction: String {
        angle == "front" ? "Look straight at the camera" : angle == "left" ? "Turn your face slightly left" : "Turn your face slightly right"
    }
    private func launchCamera() {
        operation?.cancel(); provider.stop(); ready = false; error = nil
        let next = mode == .trueDepth ? TrueDepthFaceScanProvider() : CameraFaceScanProvider()
        provider = next
        operation = Task {
            do { try await next.start(); if !Task.isCancelled && provider === next { ready = true } else { next.stop() } }
            catch { if !Task.isCancelled { self.error = error.localizedDescription } }
        }
    }
    private func capture() {
        let currentAngle = angle
        working = true; error = nil
        operation = Task {
            defer { working = false }
            do {
                let photo = try await provider.capturePhoto()
                try Task.checkCancellation()
                if currentAngle == "front" && abs(photo.yaw) > 0.22 { throw FaceScanError.captureFailed("Look straight ahead and retake the front photo.") }
                if currentAngle != "front" && (abs(photo.yaw) < 0.18 || abs(photo.yaw) > 0.85) { throw FaceScanError.captureFailed("Turn slightly to the side without hiding your face, then retry.") }
                if currentAngle == "right", let left = photos["left"], left.yaw * photo.yaw >= 0 { throw FaceScanError.captureFailed("Turn toward the opposite side from the previous photo.") }
                if mode == .trueDepth && photo.depthMeters == nil { throw FaceScanError.captureFailed("Depth was unavailable in this photo. Retry or switch to Camera.") }
                photos[currentAngle] = photo
            } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
        }
    }
    private func upload() {
        working = true; error = nil; provider.stop(); ready = false
        operation = Task {
            defer { working = false }
            do {
                let scan = try await workspace.api.upload(photos: photos, mode: mode)
                try Task.checkCancellation(); uploaded = scan; photos = [:]
                do { try await workspace.reload() } catch { self.error = "Scan saved, but history refresh failed. Pull to refresh History." }
            } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
        }
    }
}
