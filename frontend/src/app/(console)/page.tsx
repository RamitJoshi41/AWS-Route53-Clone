import { redirect } from "next/navigation";

// "Route 53" (the side-nav header and first breadcrumb) links here. Until the
// Dashboard exists, the console's main page is the hosted zones list.
export default function Home() {
  redirect("/hosted-zones");
}
