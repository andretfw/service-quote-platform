import PublicFrame from "@/components/PublicFrame";
import TemplateGallery from "@/components/TemplateGallery";
import { Text } from "@/components/Language";
export default function TemplatesPage() {
  return (
    <PublicFrame>
      <div className="page-intro">
        <span className="eyebrow">
          <Text>All templates, every plan</Text>
        </span>
        <h1>
          <Text>Start with your service. Make it yours.</Text>
        </h1>
        <p>
          <Text>
            Try a working demo, then customize the questions, measurements and pricing for your
            business. Example rates are a starting point, not market prices.
          </Text>
        </p>
      </div>
      <TemplateGallery />
    </PublicFrame>
  );
}
