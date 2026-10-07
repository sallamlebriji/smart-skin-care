import SwiftUI

@MainActor
final class NativeWorkspace: ObservableObject {
    @Published var account: Account?
    @Published var scans: [ScanRecord] = []
    @Published var busy = false
    @Published var error: String?
    @Published var endpoint = UserDefaults.standard.string(forKey: "apiEndpoint") ?? "http://localhost:8000"
    private(set) var api: APIClient
    private var generation = 0
    private var hasRestored = false
    init() {
        let address = UserDefaults.standard.string(forKey: "apiEndpoint") ?? "http://localhost:8000"
        api = APIClient(baseURL: URL(string: address) ?? URL(string: "http://localhost:8000")!)
    }
    func configureEndpoint() {
        guard !busy, account == nil else { error = "Sign out before changing the server."; return }
        guard let url = URL(string: endpoint), ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil, url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { error = "Enter an HTTP(S) server address without a path."; return }
        endpoint = url.absoluteString; generation += 1
        UserDefaults.standard.set(endpoint, forKey: "apiEndpoint")
        api = APIClient(baseURL: url); scans = []; error = nil
    }
    func restore() async {
        guard !hasRestored else { return }; hasRestored = true
        let version = generation, client = api
        busy = true; defer { busy = false }
        do {
            let user = try await client.restoreAccount()
            guard version == generation else { return }
            account = user; try await reload()
        } catch let problem as NativeAPIError where problem.status == 401 { account = nil }
        catch { self.error = error.localizedDescription }
    }
    func authenticate(email: String, password: String, register: Bool) async {
        busy = true; error = nil; defer { busy = false }
        do { account = try await api.signIn(email: email, password: password, register: register); try await reload() }
        catch { self.error = error.localizedDescription }
    }
    func reload() async throws {
        let version = generation
        let values = try await api.scans()
        if version == generation && account != nil { scans = values }
    }
    func perform(_ operation: () async throws -> Void) async {
        guard !busy else { return }
        busy = true; error = nil; defer { busy = false }
        do { try await operation() } catch { self.error = error.localizedDescription }
    }
    func signOut() async {
        await perform { try await self.api.logout(); self.generation += 1; self.account = nil; self.scans = [] }
    }
}
