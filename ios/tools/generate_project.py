"""Generate the checked-in Xcode project with only Python's standard library."""
from pathlib import Path
import hashlib
import json
import plistlib

ROOT = Path(__file__).resolve().parents[1]
objects = {}


def identifier(name):
    return hashlib.sha1(name.encode()).hexdigest()[:24].upper()


def obj(name, content):
    key = identifier(name)
    objects[key] = content
    return key


def quote(value):
    return json.dumps(str(value))


def array(values):
    return "(" + ", ".join(values) + ",)" if values else "()"


files = sorted((ROOT / "SmartSkinCare").rglob("*.swift"))
references, builds = [], []
for file in files:
    path = file.relative_to(ROOT).as_posix()
    reference = obj("ref:" + path, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; name = {quote(file.name)}; path = {quote(path)}; sourceTree = "<group>";')
    references.append(reference)
    builds.append(obj("build:" + path, f"isa = PBXBuildFile; fileRef = {reference};"))
privacy = obj("privacy", 'isa = PBXFileReference; lastKnownFileType = text.xml; path = SmartSkinCare/PrivacyInfo.xcprivacy; sourceTree = "<group>";')
info = obj("info", 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = SmartSkinCare/Info.plist; sourceTree = "<group>";')
product = obj("product", 'isa = PBXFileReference; explicitFileType = wrapper.application; path = SmartSkinCare.app; sourceTree = BUILT_PRODUCTS_DIR;')
products = obj("products", f'isa = PBXGroup; children = {array([product])}; name = Products; sourceTree = "<group>";')
group = obj("group", f'isa = PBXGroup; children = {array(references + [privacy, info, products])}; sourceTree = "<group>";')
sources = obj("sources", f"isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = {array(builds)}; runOnlyForDeploymentPostprocessing = 0;")
frameworks = obj("frameworks", "isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;")
privacy_build = obj("privacy-build", f"isa = PBXBuildFile; fileRef = {privacy};")
resources = obj("resources", f"isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = {array([privacy_build])}; runOnlyForDeploymentPostprocessing = 0;")
project_configs, target_configs = [], []
for mode in ("Debug", "Release"):
    project_settings = 'SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; CLANG_ENABLE_MODULES = YES;'
    project_configs.append(obj("project:" + mode, f"isa = XCBuildConfiguration; buildSettings = {{ {project_settings} }}; name = {mode};"))
    target_settings = ('PRODUCT_BUNDLE_IDENTIFIER = com.smartskincare.app; PRODUCT_NAME = "$(TARGET_NAME)"; '
        'INFOPLIST_FILE = SmartSkinCare/Info.plist; GENERATE_INFOPLIST_FILE = NO; SWIFT_VERSION = 5.0; '
        'SWIFT_STRICT_CONCURRENCY = minimal; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 1; '
        'SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; SUPPORTS_MACCATALYST = NO; '
        'IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_EMIT_LOC_STRINGS = YES;')
    target_settings += ' SWIFT_OPTIMIZATION_LEVEL = "-Onone"; DEBUG_INFORMATION_FORMAT = dwarf;' if mode == "Debug" else ' SWIFT_OPTIMIZATION_LEVEL = "-O"; DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";'
    target_configs.append(obj("target:" + mode, f"isa = XCBuildConfiguration; buildSettings = {{ {target_settings} }}; name = {mode};"))
project_config_list = obj("project-config-list", f"isa = XCConfigurationList; buildConfigurations = {array(project_configs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;")
target_config_list = obj("target-config-list", f"isa = XCConfigurationList; buildConfigurations = {array(target_configs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;")
target = obj("target", f'isa = PBXNativeTarget; buildConfigurationList = {target_config_list}; buildPhases = {array([sources, frameworks, resources])}; buildRules = (); dependencies = (); name = SmartSkinCare; productName = SmartSkinCare; productReference = {product}; productType = "com.apple.product-type.application";')
project = obj("project", f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1600; }}; buildConfigurationList = {project_config_list}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en, Base); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = {array([target])};')
directory = ROOT / "SmartSkinCare.xcodeproj"
directory.mkdir(exist_ok=True)
content = "// !$*UTF8*$!\n{\narchiveVersion = 1; classes = {}; objectVersion = 56;\nobjects = {\n"
content += "\n".join(f"{key} = {{ {value} }};" for key, value in objects.items())
content += f"\n}}; rootObject = {project};\n}}\n"
(directory / "project.pbxproj").write_text(content, encoding="utf-8")
scheme = directory / "xcshareddata" / "xcschemes"
scheme.mkdir(parents=True, exist_ok=True)
reference = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="SmartSkinCare.app" BlueprintName="SmartSkinCare" ReferencedContainer="container:SmartSkinCare.xcodeproj"/>'
(scheme / "SmartSkinCare.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables/></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>''', encoding="utf-8")
privacy_path = ROOT / "SmartSkinCare" / "PrivacyInfo.xcprivacy"
with privacy_path.open("rb") as handle:
    privacy_manifest = plistlib.load(handle)
privacy_manifest["NSPrivacyCollectedDataTypes"] = [{
    "NSPrivacyCollectedDataType": "NSPrivacyCollectedDataType" + category,
    "NSPrivacyCollectedDataTypeLinked": True,
    "NSPrivacyCollectedDataTypeTracking": False,
    "NSPrivacyCollectedDataTypePurposes": ["NSPrivacyCollectedDataTypePurposeAppFunctionality"],
} for category in ("EmailAddress", "PhotosorVideos", "UserID", "Health", "OtherDataTypes")]
with privacy_path.open("wb") as handle:
    plistlib.dump(privacy_manifest, handle)
print(f"Generated Xcode project with {len(files)} Swift sources. Xcode/device compilation is still required.")
