import { useTranslation } from "../i18n";

export default ({ error }: { error: any }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-red-600 text-sm">
        {t.dynamic.errorMessage(error.toString())}
      </p>
    </div>
  );
};
