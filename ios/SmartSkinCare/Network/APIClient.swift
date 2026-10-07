import Foundation

struct NativeAPIError: LocalizedError {
    let status: Int
    let message: String
    var errorDescription: String? { message }
}
actor APIClient {
    let baseURL: URL
    private let session: URLSession
    private var refreshTask: Task<Void, Error>?
    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieStorage = .shared
        configuration.httpCookieAcceptPolicy = .always
        configuration.timeoutIntervalForRequest = 120
        self.session = URLSession(configuration: configuration)
    }
    func request<T: Decodable>(_ path: String, method: String = "GET", body: Data? = nil, contentType: String = "application/json") async throws -> T {
        let data = try await execute(path, method: method, body: body, contentType: contentType)
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data.isEmpty ? Data("{}".utf8) : data)
    }
    private func execute(_ path: String, method: String, body: Data?, contentType: String, retry: Bool = true) async throws -> Data {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else { throw NativeAPIError(status: 0, message: "Invalid API URL") }
        var request = URLRequest(url: url); request.httpMethod = method; request.httpBody = body
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        if !path.hasPrefix("/api/auth/") { request.setValue("true", forHTTPHeaderField: "X-Account-Session") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw NativeAPIError(status: 0, message: "Invalid API response") }
        if http.statusCode == 401 && retry && !path.hasPrefix("/api/auth/") {
            try await refresh(); return try await execute(path, method: method, body: body, contentType: contentType, retry: false)
        }
        guard (200..<300).contains(http.statusCode) else {
            let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw NativeAPIError(status: http.statusCode, message: json?["detail"] as? String ?? "Request failed (\(http.statusCode)). Check your connection and retry.")
        }
        return data
    }
    func refresh() async throws {
        if let task = refreshTask { return try await task.value }
        let task = Task<Void, Error> { _ = try await self.execute("/api/auth/refresh", method: "POST", body: nil, contentType: "application/json", retry: false) }
        refreshTask = task
        defer { refreshTask = nil }
        try await task.value
    }
    func restoreAccount() async throws -> Account {
        do { return try await request("/api/auth/me") }
        catch let error as NativeAPIError where error.status == 401 {
            try await refresh(); return try await request("/api/auth/me")
        }
    }
    func signIn(email: String, password: String, register: Bool) async throws -> Account {
        let body = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        return try await request(register ? "/api/auth/register" : "/api/auth/login", method: "POST", body: body)
    }
    func logout() async throws { let _: EmptyResponse = try await request("/api/auth/logout", method: "POST") }
    func scans() async throws -> [ScanRecord] { try await request("/api/scans") }
    func analyze(_ id: String) async throws -> FaceScanResult { try await request("/api/scans/\(id)/analyze", method: "POST") }
    func delete(_ id: String) async throws { let _: EmptyResponse = try await request("/api/scans/\(id)", method: "DELETE") }
    func upload(photos: [String: NativePhoto], mode: CaptureMode) async throws -> ScanRecord {
        let boundary = "SmartSkin-\(UUID().uuidString)"
        var data = Data()
        func field(_ name: String, _ value: String) {
            data.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8))
        }
        field("consent", "true"); field("capture_mode", mode.rawValue)
        let quality = photos.mapValues { $0.uploadQuality }
        field("quality", String(data: try JSONSerialization.data(withJSONObject: quality), encoding: .utf8)!)
        for angle in ["front", "left", "right"] {
            guard let photo = photos[angle] else { throw NativeAPIError(status: 0, message: "Capture all three angles first.") }
            data.append(Data("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(angle)\"; filename=\"\(angle).jpg\"\r\nContent-Type: image/jpeg\r\n\r\n".utf8))
            data.append(photo.jpeg); data.append(Data("\r\n".utf8))
        }
        data.append(Data("--\(boundary)--\r\n".utf8))
        return try await request("/api/scans", method: "POST", body: data, contentType: "multipart/form-data; boundary=\(boundary)")
    }
}
