use std::path::PathBuf;
use ts_rs::TS;

include!("src/models.rs");

fn main() {
    println!("cargo:rerun-if-changed=src");
    // Set the output path for TypeScript types (relative to the project root)
    let dest_path = PathBuf::from("src/types/generated_types.ts");

    // Export the Rust types as TypeScript definitions
    ts_rs::export::export_to(dest_path, vec![&StoryNode::export()])
        .expect("Failed to export TypeScript types");
}
