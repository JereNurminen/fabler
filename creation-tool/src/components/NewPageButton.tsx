import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import { useLocation } from "wouter";
import { getLinkToPagePage } from "../utilities/routing";
import { Button } from "./ui/Button";

interface NewPageButtonProps {
  storyId: number;
}

export default ({ storyId }: NewPageButtonProps) => {
  const { createPage } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const createNewPage = async () => {
    try {
      const pageId = await createPage();
      setLocation(getLinkToPagePage(storyId, pageId));
    } catch (error) {
      console.error("Failed to create page:", error);
    }
  };

  return (
    <Button onClick={() => createNewPage()} className="w-full" variant="success">
      {t.buttons.createPage}
    </Button>
  );
};
