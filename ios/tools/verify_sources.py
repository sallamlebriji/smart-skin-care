"""Cross-platform structural checks. This does NOT compile/type-check iOS code."""
from pathlib import Path
import plistlib
import re
import xml.etree.ElementTree as ET
from tree_sitter import Language, Parser
import tree_sitter_swift
from openstep_parser import OpenStepDecoder

ROOT = Path(__file__).resolve().parents[1]
parser = Parser(Language(tree_sitter_swift.language()))
files = sorted((ROOT / "SmartSkinCare").rglob("*.swift"))
failures = []
for file in files:
    source = file.read_text(encoding="utf-8-sig").encode()
    tree = parser.parse(source)
    if tree.root_node.has_error:
        def visit(node):
            if node.type == "ERROR" or node.is_missing:
                failures.append(f"{file.relative_to(ROOT)}:{node.start_point.row + 1}: {node.type} {source[node.start_byte:node.end_byte][:100]!r}")
            for child in node.children:
                visit(child)
        visit(tree.root_node)
for path in (ROOT / "SmartSkinCare/Info.plist", ROOT / "SmartSkinCare/PrivacyInfo.xcprivacy"):
    with path.open("rb") as handle: plistlib.load(handle)
project_text = (ROOT / "SmartSkinCare.xcodeproj/project.pbxproj").read_text()
project = OpenStepDecoder.ParseFromString(project_text)
objects = project["objects"]
assert project["rootObject"] in objects
for reference in re.findall(r"\b[A-F0-9]{24}\b", project_text):
    assert reference in objects, f"Unknown project reference {reference}"
swift_paths = {value["path"] for value in objects.values() if value.get("isa") == "PBXFileReference" and value.get("lastKnownFileType") == "sourcecode.swift"}
assert swift_paths == {file.relative_to(ROOT).as_posix() for file in files}
build_files = {value["fileRef"] for value in objects.values() if value.get("isa") == "PBXBuildFile"}
for key, value in objects.items():
    if value.get("lastKnownFileType") == "sourcecode.swift": assert key in build_files
scheme = ET.parse(ROOT / "SmartSkinCare.xcodeproj/xcshareddata/xcschemes/SmartSkinCare.xcscheme")
for reference in scheme.findall(".//BuildableReference"):
    assert objects[reference.attrib["BlueprintIdentifier"]]["isa"] == "PBXNativeTarget"
if failures:
    raise SystemExit("\n".join(failures))
print(f"Swift syntax parsed for {len(files)} files; project references, build entries, scheme and property lists are consistent.")
print("Not verified here: Swift type checking, SDK availability, Xcode compilation, signing or device camera behavior.")
