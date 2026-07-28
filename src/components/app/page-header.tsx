export function PageHeader(props: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <p>{props.eyebrow}</p>
        <h1>{props.title}</h1>
        <span>{props.description}</span>
      </div>
      {props.action}
    </div>
  );
}
