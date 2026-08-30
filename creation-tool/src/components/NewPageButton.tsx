import { useStoryAtoms } from "../atoms/useStoryAtoms";
import { useTranslation } from "../i18n";
import { useLocation } from "wouter";
import { getLinkToPage } from "../utilities/routing";
import { Button } from "./ui/Button";
import { useTrackedAction } from "../hooks/useTrackedAction";

const NewPageButton = () => {
  const { createPage } = useStoryAtoms();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const createNewPage = useTrackedAction(async () => {
    const page = await createPage("New Page");
    setLocation(getLinkToPage(page.id));
  });

  return (
    <Button onClick={() => createNewPage()} className="w-full" variant="success">
      {t.buttons.createPage}
    </Button>
  );
};

export default NewPageButton;
