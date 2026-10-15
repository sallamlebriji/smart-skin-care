import Foundation
import UIKit

enum CaptureMode: String, Codable, Hashable { case camera; case trueDepth = "truedepth" }
struct ScanQuality: Codable { let lighting: Double; let faceVisibility: Double; let position: Double }
struct FaceScanResult: Codable {
    let scanId: String
    let createdAt: String
    let captureMode: CaptureMode
    let quality: ScanQuality
    let skinTypeEstimate: String
    let overallScore: Double
    let metrics: [String: Double]
    let regions: [String: [String: Double]]
    let confidence: Double
    let isMockResult: Bool
    let mockMetrics: [String]
    var measuredMetrics: [(String, Double)] { metrics.filter { !mockMetrics.contains($0.key) }.sorted { $0.key < $1.key } }
}
struct ScanRecord: Codable, Identifiable {
    let scanId: String
    let createdAt: String
    let captureMode: CaptureMode
    let status: String
    let result: FaceScanResult?
    let wrinkleAssessment: WrinkleAssessment?
    var id: String { scanId }
}
struct WrinkleAssessment: Codable {
    let label: String
    let wrinkleProbability: Double
    let model: String
    let revision: String
    let experimental: Bool
}
struct Account: Codable { let id: String; let email: String }
struct EmptyResponse: Decodable {}
struct NativePhoto {
    let jpeg: Data
    let image: UIImage
    let luma: Double
    let imbalance: Double
    let yaw: Double
    let landmarks: [CGPoint]
    let faceArea: Double
    let depthMeters: Double?
    var uploadQuality: [String: Double] { ["luma": luma, "yaw": max(0, min(1, 0.5 + yaw / .pi)), "imbalance": imbalance] }
}
struct RoutineStep: Codable, Identifiable {
    var order: Int
    var name: String
    var reason: String?
    var frequency: String?
    var id: Int { order }
}
struct SkinRoutine: Codable { var morning: [RoutineStep]; var evening: [RoutineStep] }
struct ChatItem: Codable, Identifiable { let id: String; let role: String; let content: String; let createdAt: String }
struct ChatHistory: Codable { let aiAvailable: Bool; let messages: [ChatItem] }
struct ChatReply: Codable { let answer: String; let provider: String }
