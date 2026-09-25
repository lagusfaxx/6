import ForumFeed from "../../_components/ForumFeed";

export default function CategoryPage({ params }: { params: { slug: string } }) {
  return <ForumFeed initialCategory={decodeURIComponent(params.slug)} />;
}
