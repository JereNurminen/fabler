use serde::{Deserialize, Serialize};
use specta::Type;
use ts_rs::TS;

pub type PageId = i64;

pub type StoryId = i64;

pub type OptionId = i64;

pub type FlagId = i64;

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct Story {
    pub id: StoryId,
    pub title: String,
    pub pages: Vec<Page>,
    pub start_page: PageId,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct StoryListing {
    pub id: StoryId,
    pub title: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct PageListItem {
    pub id: PageId,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct StoryOutline {
    pub id: StoryId,
    pub title: String,
    pub pages: Vec<PageListItem>,
    pub start_page: PageId,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct Page {
    pub id: PageId,
    pub story_id: StoryId,
    pub name: String,
    pub body: String,
    pub options: Vec<Choice>,
    pub flag_operations: Vec<FlagOperation>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct Choice {
    pub id: OptionId,
    pub page_id: PageId,
    pub text: String,
    pub target_page: PageId,
    pub flag_operations: Vec<FlagOperation>,
    pub conditions: Vec<ChoiceCondition>,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct Flag {
    pub id: FlagId,
    pub story_id: StoryId,
    pub name: String,
    pub default_value: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct FlagOperation {
    pub id: i64,
    pub flag_id: FlagId,
    pub operation: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, TS, Type)]
#[ts(export)]
pub struct ChoiceCondition {
    pub id: i64,
    pub flag_id: FlagId,
    pub required_value: bool,
}
