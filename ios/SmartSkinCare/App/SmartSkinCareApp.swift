import SwiftUI

@main
@MainActor
struct SmartSkinCareApp: App {
    @StateObject private var workspace = NativeWorkspace()
    var body: some Scene {
        WindowGroup { NativeRootView().environmentObject(workspace) }
    }
}
