import { MomentumHome } from "@/app/page";

export default async function JoinGroupPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  return <MomentumHome initialInviteCode={code.toLowerCase()} />;
}
