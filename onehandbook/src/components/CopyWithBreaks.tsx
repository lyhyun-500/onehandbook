import { Fragment } from "react";
import { splitCopyAtPunctuation } from "@/lib/splitCopyAtPunctuation";

type CopyWithBreaksProps = {
  children: string;
  className?: string;
  as?: "span" | "p" | "div";
};

/**
 * 마침표·쉼표마다 줄바꿈(숫자·도메인 형태는 제외).
 */
export function CopyWithBreaks({
  children,
  className,
  as: Tag = "span",
}: CopyWithBreaksProps) {
  const lines = splitCopyAtPunctuation(children);
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </Tag>
  );
}
