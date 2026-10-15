import SwiftUI

private let disclaimer = "Visual appearance estimates, not a medical diagnosis. Simulated indicators are excluded."

struct NativeRootView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    var body: some View {
        Group {
            if workspace.account != nil {
                TabView {
                    NativeHistoryView().tabItem { Label("History", systemImage: "clock") }
                    NativeScanView().tabItem { Label("Scan", systemImage: "camera") }
                    NativeRoutineView().tabItem { Label("Routine", systemImage: "sun.max") }
                    NativeChatView().tabItem { Label("Assistant", systemImage: "bubble.left") }
                    NativeAccountView().tabItem { Label("Account", systemImage: "person") }
                }
            } else { NativeAccountView() }
        }.tint(Color(red: 0.36, green: 0.31, blue: 0.84)).task { await workspace.restore() }
    }
}

struct NativeAccountView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    @State private var email = ""
    @State private var password = ""
    @State private var register = false
    var body: some View {
        NavigationStack {
            Form {
                if let account = workspace.account {
                    Section("Signed in") { Text(account.email); Button("Sign out", role: .destructive) { Task { await workspace.signOut() } } }
                } else {
                    Section(register ? "Create account" : "Sign in") {
                        TextField("Email", text: $email).keyboardType(.emailAddress).textContentType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled()
                        SecureField("Password (8+ characters)", text: $password).textContentType(register ? .newPassword : .password)
                        Button(register ? "Create account" : "Sign in") {
                            Task { await workspace.authenticate(email: email, password: password, register: register); if workspace.account != nil { password = "" } }
                        }.disabled(workspace.busy || password.count < 8 || !email.contains("@"))
                        Toggle("Create a new account", isOn: $register)
                    }
                    Section("Server") {
                        TextField("API server URL", text: $workspace.endpoint).keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        Button("Use this server") { workspace.configureEndpoint() }
                        Text("On an iPhone, localhost means the phone. Use your server's HTTPS address or a trusted local .local hostname.").font(.caption)
                    }
                }
                if workspace.busy { ProgressView() }
                if let error = workspace.error { Section { Text(error).foregroundStyle(.red) } }
                Section { Text(disclaimer).font(.caption) }
            }.disabled(workspace.busy).navigationTitle("Smart Skin Care")
        }
    }
}

struct NativeHistoryView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    @State private var deletion: ScanRecord?
    @State private var selected = Set<String>()
    var body: some View {
        NavigationStack {
            List {
                if workspace.scans.isEmpty { Text("No scans saved yet. Open the Scan tab to begin.") }
                ForEach(workspace.scans) { scan in
                    Section(String(scan.createdAt.prefix(10))) {
                        if let result = scan.result {
                            ForEach(result.measuredMetrics, id: \.0) { metric in
                                HStack { Text(metric.0.capitalized); Spacer(); Text("\(metric.1, specifier: "%.0f")/100") }
                            }
                            if !result.mockMetrics.isEmpty { Text("Other indicators have not been analyzed.").font(.caption) }
                            Toggle("Compare this scan", isOn: Binding(get: { selected.contains(scan.id) }, set: { enabled in
                                if enabled && selected.count < 2 { selected.insert(scan.id) } else { selected.remove(scan.id) }
                            })).disabled(selected.count == 2 && !selected.contains(scan.id))
                        } else {
                            Button("Run analysis") { Task { await workspace.perform { _ = try await workspace.api.analyze(scan.id); try await workspace.reload() } } }
                        }
                        if let assessment = scan.wrinkleAssessment {
                            Text(assessment.label == "wrinkle" ? "Wrinkles detected by the model" : "Wrinkles not detected by the model").bold()
                            Text("Wrinkle class probability: \(assessment.wrinkleProbability * 100, specifier: "%.1f")%. Experimental; not a severity score or clinical confidence.").font(.caption)
                            Text("\(assessment.model) · \(assessment.revision.prefix(7))").font(.caption)
                        }
                        Button("Detect wrinkles only · experimental") { Task { await workspace.perform {
                            let _: WrinkleAssessment = try await workspace.api.request("/api/scans/\(scan.id)/analyze-wrinkles", method: "POST")
                            try await workspace.reload()
                        } } }
                        Button("Delete scan and photos", role: .destructive) { deletion = scan }
                    }
                }
                let compared = workspace.scans.filter { selected.contains($0.id) }
                if compared.count == 2, let first = compared[0].result, let second = compared[1].result {
                    Section("Appearance comparison") {
                        ForEach(first.measuredMetrics.filter { !second.mockMetrics.contains($0.0) }, id: \.0) { metric in
                            Text("\(metric.0): \(Int(metric.1)) → \(Int(second.metrics[metric.0] ?? metric.1)) /100")
                        }
                        Text("Lighting and camera changes can affect estimates. Overall scores are excluded.").font(.caption)
                    }
                }
                if let error = workspace.error { Text(error).foregroundStyle(.red) }
                Text(disclaimer).font(.caption)
            }.disabled(workspace.busy).navigationTitle("Your scans")
                .overlay { if workspace.busy { ProgressView() } }
                .refreshable { await workspace.perform { try await workspace.reload() } }
                .confirmationDialog("Delete this scan and its server photos?", isPresented: Binding(get: { deletion != nil }, set: { if !$0 { deletion = nil } })) {
                    if let scan = deletion { Button("Delete permanently", role: .destructive) { Task { await workspace.perform { try await workspace.api.delete(scan.id); selected.remove(scan.id); try await workspace.reload() }; deletion = nil } } }
                }
        }
    }
}

struct NativeRoutineView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    @State private var routine = SkinRoutine(morning: [], evening: [])
    @State private var error: String?
    @State private var busy = false
    @State private var saved = false
    var body: some View {
        NavigationStack {
            Form {
                section("Morning", morning: true)
                section("Evening", morning: false)
                if let scan = workspace.scans.first(where: { $0.result != nil }) {
                    Button("Build from latest scan") { Task { await load(from: scan.id) } }
                }
                Button("Save routine") { Task {
                    busy = true; defer { busy = false }; error = nil
                    do { routine = try await workspace.api.request("/api/routine", method: "PUT", body: JSONEncoder().encode(routine)); saved = true }
                    catch { self.error = error.localizedDescription }
                } }.disabled(routine.morning.contains { $0.name.trimmingCharacters(in: .whitespaces).isEmpty } || routine.evening.contains { $0.name.trimmingCharacters(in: .whitespaces).isEmpty })
                if saved { Text("Routine saved.").foregroundStyle(.green) }
                if let error = error { Text(error).foregroundStyle(.red) }
                Text(disclaimer).font(.caption)
            }.disabled(busy).navigationTitle("Your routine").task { await load(from: nil) }
        }
    }
    private func section(_ title: String, morning: Bool) -> some View {
        Section(title) {
            let steps = morning ? routine.morning : routine.evening
            ForEach(steps.indices, id: \.self) { index in
                TextField("Step \(index + 1)", text: Binding(get: {
                    let current = morning ? routine.morning : routine.evening
                    return current.indices.contains(index) ? current[index].name : ""
                }, set: { value in
                    guard (morning ? routine.morning : routine.evening).indices.contains(index) else { return }
                    if morning { routine.morning[index].name = String(value.prefix(200)) } else { routine.evening[index].name = String(value.prefix(200)) }; saved = false
                }))
                Button("Remove step", role: .destructive) {
                    guard (morning ? routine.morning : routine.evening).indices.contains(index) else { return }
                    if morning { routine.morning.remove(at: index); for i in routine.morning.indices { routine.morning[i].order = i + 1 } }
                    else { routine.evening.remove(at: index); for i in routine.evening.indices { routine.evening[i].order = i + 1 } }; saved = false
                }
            }
            Button("Add step") {
                let step = RoutineStep(order: steps.count + 1, name: "", reason: nil, frequency: "Daily")
                if morning { routine.morning.append(step) } else { routine.evening.append(step) }; saved = false
            }.disabled(steps.count >= 20)
        }
    }
    private func load(from id: String?) async {
        busy = true; defer { busy = false }; error = nil
        do {
            if let id = id { routine = try await workspace.api.request("/api/routine?scan_id=\(id)") }
            else { let value: SkinRoutine? = try await workspace.api.request("/api/routine/saved"); if let value = value { routine = value } }
            saved = false
        } catch { self.error = error.localizedDescription }
    }
}

struct NativeChatView: View {
    @EnvironmentObject var workspace: NativeWorkspace
    @State private var history = ChatHistory(aiAvailable: false, messages: [])
    @State private var message = ""
    @State private var consent = false
    @State private var busy = false
    @State private var error: String?
    @State private var provider = ""
    @State private var deleting = false
    var body: some View {
        NavigationStack {
            Form {
                Section("Conversation") {
                    ForEach(history.messages) { item in VStack(alignment: .leading) { Text(item.role == "user" ? "You" : "Assistant").bold(); Text(item.content) } }
                    if history.messages.isEmpty { Text("Ask about your recorded scans or routine.") }
                }
                Section("Your question") {
                    TextField("Explain my latest scan", text: $message, axis: .vertical).lineLimit(2...5)
                    if history.aiAvailable { Toggle("Allow this question, recent conversation, available estimates, self-reported skin type and routine to be sent to OpenAI. Photos are excluded.", isOn: $consent).font(.caption) }
                    else { Text("The server currently uses local summary rules.").font(.caption) }
                    Button("Send") { Task {
                        busy = true; error = nil; defer { busy = false }
                        do {
                            let data = try JSONSerialization.data(withJSONObject: ["message": String(message.prefix(2000)), "allow_external_ai": consent])
                            let reply: ChatReply = try await workspace.api.request("/api/chat", method: "POST", body: data)
                            provider = reply.provider; message = ""; consent = false
                            history = try await workspace.api.request("/api/chat/history")
                        } catch { self.error = error.localizedDescription }
                    } }.disabled(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if !provider.isEmpty { Text(provider == "openai" ? "AI response" : "Local summary response").font(.caption) }
                    Button("Delete conversation", role: .destructive) { deleting = true }.disabled(history.messages.isEmpty)
                }
                if let error = error { Text(error).foregroundStyle(.red) }
                Text(disclaimer).font(.caption)
            }.disabled(busy).navigationTitle("Scan assistant").task { await load() }
                .confirmationDialog("Delete your saved conversation?", isPresented: $deleting) {
                    Button("Delete permanently", role: .destructive) { Task {
                        busy = true; defer { busy = false }
                        do { let _: EmptyResponse = try await workspace.api.request("/api/chat/history", method: "DELETE"); await load(); provider = "" }
                        catch { self.error = error.localizedDescription }
                    } }
                }
        }
    }
    private func load() async {
        busy = true; error = nil; defer { busy = false }
        do { history = try await workspace.api.request("/api/chat/history") }
        catch { self.error = error.localizedDescription }
    }
}
