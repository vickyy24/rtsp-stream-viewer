import { Link } from "react-router";

const lastUpdated = "October 5, 2026";

const legalContent = {
    privacy: {
        title: "Privacy Policy",
        intro: "This policy explains how RTSP Stream Viewer handles information when you use the service.",
        sections: [
            {
                heading: "Information we handle",
                paragraphs: [
                    "When you create an account, we process your name, email address, and password. Passwords are stored as password hashes, not as readable passwords. We use your email address to deliver account verification and password-reset messages.",
                    "If you add a camera, we store its name, optional location, and RTSP or RTSPS address. Stream addresses may contain camera credentials, so the backend encrypts saved addresses at rest. When you start a stream, the backend uses that address to connect to the camera and relay video to your browser.",
                    "The service also processes authentication tokens and basic operational information needed to secure accounts, operate streams, and diagnose errors. The browser stores authentication tokens in local or session storage according to your sign-in choice, and keeps some interface preferences locally.",
                ],
            },
            {
                heading: "How information is used",
                paragraphs: [
                    "We use information to provide account access, verify email addresses, reset passwords, save and display your cameras, relay requested live streams, and maintain and protect the service. We do not use camera streams for advertising.",
                    "The backend handles account verification and password-reset email delivery. When you use Google sign-in, Google processes your sign-in information under Google's own privacy terms.",
                ],
            },
            {
                heading: "Service providers and storage",
                paragraphs: [
                    "The application uses hosting and infrastructure providers to operate the frontend, backend, and database. Information is processed by those providers only as needed to provide the service, and is subject to their respective terms and privacy practices. Data may be processed in the regions where those providers operate.",
                ],
            },
            {
                heading: "Retention and your choices",
                paragraphs: [
                    "Account and camera information is retained while it is needed to provide the service. You can remove saved cameras through the application. To request access, correction, or deletion of account information, contact the operator using the email address shown on the Google OAuth consent screen.",
                    "You can stop a live stream at any time using the stream controls. Removing a camera stops the service from using its saved address for future connections; it does not change credentials stored on the camera itself.",
                ],
            },
            {
                heading: "Security",
                paragraphs: [
                    "We use reasonable technical measures intended to protect information, including password hashing, encrypted storage of saved stream addresses, and authenticated access to account-specific camera data. No method of storage or transmission is completely secure.",
                ],
            },
            {
                heading: "Children and changes",
                paragraphs: [
                    "The service is not designed for children under 13, and we do not knowingly collect personal information from children under 13. We may update this policy as the service changes. The date above indicates the latest revision.",
                ],
            },
        ],
    },
    terms: {
        title: "Terms of Service",
        intro: "By accessing or using RTSP Stream Viewer, you agree to these terms. If you do not agree, do not use the service.",
        sections: [
            {
                heading: "Using the service",
                paragraphs: [
                    "You are responsible for your account and for keeping your sign-in credentials secure. Provide accurate account information and notify the operator if you believe your account has been used without permission.",
                    "You may add only cameras and streams that you own or are authorized to access. You are responsible for complying with applicable laws, privacy obligations, and the camera owner's requirements. Do not use the service to access, monitor, or record anyone without proper authorization.",
                ],
            },
            {
                heading: "Acceptable use",
                paragraphs: [
                    "Do not use the service to violate laws or others' rights, interfere with the service or its infrastructure, attempt unauthorized access, distribute malware, or overload stream or application resources. We may suspend access when reasonably necessary to protect users or the service.",
                ],
            },
            {
                heading: "Camera streams and availability",
                paragraphs: [
                    "You provide the camera address and any credentials needed to access it. The backend connects to the camera only when a stream is started and relays the resulting video to your browser. Stream availability and quality depend on your camera, network, and the service infrastructure.",
                    "The service is provided on an as-available basis. We do not guarantee uninterrupted operation, compatibility with every camera, or that stream errors can always be resolved.",
                ],
            },
            {
                heading: "Your content and account",
                paragraphs: [
                    "You retain responsibility for camera names, locations, addresses, and any content accessed through your streams. You grant the service permission to process that information only as needed to operate the features you request and as described in the Privacy Policy.",
                    "You may stop using the service and remove saved cameras at any time. Contact the operator using the email address shown on the Google OAuth consent screen for account-related requests.",
                ],
            },
            {
                heading: "Third-party services and changes",
                paragraphs: [
                    "The service relies on third-party hosting, database, email, and identity providers. Their services are governed by their own terms. Features may change or be discontinued as the application develops.",
                ],
            },
            {
                heading: "Liability",
                paragraphs: [
                    "To the extent permitted by law, the service is provided without warranties, and the operator is not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service. Nothing in these terms limits rights or remedies that cannot legally be limited.",
                ],
            },
            {
                heading: "Changes to these terms",
                paragraphs: [
                    "We may revise these terms as the service changes. Continued use after revised terms are posted means you accept the updated terms. The date above indicates the latest revision.",
                ],
            },
        ],
    },
};

export default function LegalPage({ type }) {
    const { title, intro, sections } = legalContent[type];

    return (
        <main className="min-h-dvh bg-stone-50 px-4 py-10 text-stone-800 sm:px-6 sm:py-16">
            <article className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
                <header className="mb-8 border-b border-stone-200 pb-6">
                    <Link className="text-sm font-semibold text-sky-700 hover:text-sky-900" to="/signin">
                        RTSP Stream Viewer
                    </Link>
                    <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-950">{title}</h1>
                    <p className="mt-2 text-sm text-stone-500">Last updated: {lastUpdated}</p>
                    <p className="mt-5 leading-7 text-stone-700">{intro}</p>
                </header>

                <div className="space-y-7">
                    {sections.map(({ heading, paragraphs }) => (
                        <section key={heading}>
                            <h2 className="text-lg font-semibold text-stone-900">{heading}</h2>
                            {paragraphs.map((paragraph) => (
                                <p className="mt-2 leading-7 text-stone-700" key={paragraph}>{paragraph}</p>
                            ))}
                        </section>
                    ))}
                </div>

                <footer className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-stone-200 pt-5 text-sm">
                    <Link className="text-sky-700 hover:underline" to="/privacy">Privacy Policy</Link>
                    <Link className="text-sky-700 hover:underline" to="/terms">Terms of Service</Link>
                    <Link className="text-sky-700 hover:underline" to="/signup">Create an account</Link>
                </footer>
            </article>
        </main>
    );
}
