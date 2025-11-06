"use client";

import { useMiniApp } from "@neynar/react";
import { Button } from "@/components/base/Button";
import { Typography } from "@/components/base/Typography";
import { CurrentHolderItem } from "@/components/ui/timeline/CurrentHolderItem";
import { CastingWidget } from "@/components/ui/CastingWidget";
import { WinnerSelectionWidget } from "@/components/ui/WinnerSelectionWidget";
import { PublicChanceWidget } from "@/components/ui/PublicChanceWidget";
import { CastDisplayWidget } from "@/components/ui/CastDisplayWidget";
import { JourneyTimeline } from "@/components/ui/timeline";
import { useCurrentHolder } from "@/hooks/useCurrentHolder";
import { useWorkflowState } from "@/hooks/useWorkflowState";
import { useSoundPlayer } from "@/hooks/useSoundPlayer";
import { useYoinkCountdown } from "@/hooks/useYoinkCountdown";
import { WorkflowState } from "@/lib/workflow-types";
import { APP_URL } from "@/lib/constants";
import { sdk } from "@farcaster/miniapp-sdk";
import Image from "next/image";
import { ChevronsDown } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";

interface HomePageProps {
	title: string;
	timelineRefreshTrigger: number;
}

export function HomePage({ timelineRefreshTrigger }: HomePageProps) {
	const { context, setActiveTab } = useMiniApp();
	const { isCurrentHolder, loading: isHolderLoading } = useCurrentHolder();
	const {
		workflowData,
		loading: isWorkflowLoading,
		refetch: refreshWorkflow,
	} = useWorkflowState();
	// disabled for now -- share button
	//const { address: userAddress, isLoading: isAddressLoading } = useCurrentUserAddress();
	const { playChooChoo } = useSoundPlayer();
	const countdownState = useYoinkCountdown();
	// const [rideHistoryStatus, setRideHistoryStatus] = useState<
	//   'loading' | 'has-ridden' | 'not-ridden' | 'error'
	// >('loading');

	// Scroll indicator state
	const [showScrollIndicator, setShowScrollIndicator] = useState(true);
	const [hasScrolled, setHasScrolled] = useState(false);

	// Refs for scroll targets
	const winnerSelectionRef = useRef<HTMLDivElement>(null);
	const castingWidgetRef = useRef<HTMLDivElement>(null);
	const castDisplayRef = useRef<HTMLDivElement>(null);
	const publicChanceRef = useRef<HTMLDivElement>(null);
	const currentHolderRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const [visible, setVisible] = useState<Record<string, boolean>>({});

	const handleWorkflowRefresh = () => {
		refreshWorkflow();
	};

	const getScrollTarget = useCallback(() => {
		const targets = [
			winnerSelectionRef,
			castingWidgetRef,
			castDisplayRef,
			publicChanceRef,
		];

		for (const ref of targets) {
			if (ref.current && ref.current.offsetParent !== null) {
				return ref.current;
			}
		}

		return currentHolderRef.current;
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;

		const entriesToState = (entries: IntersectionObserverEntry[]) => {
			setVisible((prev) => {
				const next = { ...prev } as Record<string, boolean>;
				for (const e of entries) {
					const id = (e.target as HTMLElement).dataset.scrollid as string;
					if (!id) continue;
					next[id] = e.isIntersecting && e.intersectionRatio > 0.05;
				}
				return next;
			});
		};

		const io = new IntersectionObserver(entriesToState, {
			root,
			threshold: [0, 0.05, 0.5, 1],
			rootMargin: "0px 0px -15% 0px",
		});

		const targets: Array<{ id: string; el: HTMLElement | null }> = [
			{ id: "winner", el: winnerSelectionRef.current },
			{ id: "casting", el: castingWidgetRef.current },
			{ id: "display", el: castDisplayRef.current },
			{ id: "chance", el: publicChanceRef.current },
		];

		const observed: HTMLElement[] = [];
		for (const { id, el } of targets) {
			if (el) {
				el.dataset.scrollid = id;
				io.observe(el);
				observed.push(el);
			}
		}

		// Kick an initial measurement
		root.dispatchEvent(new Event("scroll"));

		return () => {
			for (const el of observed) io.unobserve(el);
			io.disconnect();
		};
	}, [workflowData.state, isCurrentHolder]);

	// use container metrics for scroll indicator logic
	useEffect(() => {
		const root = containerRef.current;
		if (!root) return;

		let ticking = false;
		const handleScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				ticking = false;
				const scrollTop = root.scrollTop;
				const containerHeight = root.clientHeight;
				const contentHeight = root.scrollHeight;

				if (scrollTop > 0 && !hasScrolled) setHasScrolled(true);

				const isNearBottom = scrollTop + containerHeight >= contentHeight - 100;

				// Determine if there is a next target to scroll to (first non-visible prioritized target)
				const nextExists =
					!visible["winner"] ||
					!visible["casting"] ||
					!visible["display"] ||
					!visible["chance"];
				const isPageScrollable = contentHeight > containerHeight + 50; // buffer

				setShowScrollIndicator(
					!isNearBottom && (nextExists || isPageScrollable),
				);
			});
		};

		root.addEventListener("scroll", handleScroll, { passive: true });
		// Initial check
		handleScroll();
		return () => root.removeEventListener("scroll", handleScroll);
	}, [hasScrolled, visible]);

	const handleAllAboard = async () => {
		try {
			// Play ChooChoo sound when button is clicked
			playChooChoo({ volume: 0.7 });

			// Send cast
			await sdk.actions.composeCast({
				text: "Got @choochoo FOMO? Check out the mini-app for a chance to ride 🚂",
				embeds: [APP_URL],
			});
		} catch (error) {
			console.error('[HomePage] Failed to compose "All aboard" cast:', error);
		}
	};

	/** @dev unused for now - share button */
	// Check if user has ridden ChooChoo before
	// useEffect(() => {
	//   async function checkRideHistory() {
	//     if (!userAddress) {
	//       setRideHistoryStatus('error');
	//       return;
	//     }

	//     setRideHistoryStatus('loading');
	//     try {
	//       const response = await fetch(`/api/has-ridden?address=${userAddress}`);
	//       if (response.ok) {
	//         const data = await response.json();
	//         setRideHistoryStatus(data.hasRidden ? 'has-ridden' : 'not-ridden');
	//       } else {
	//         console.error('[HomePage] API error checking ride history:', response.status);
	//         setRideHistoryStatus('error');
	//       }
	//     } catch (error) {
	//       console.error('[HomePage] Failed to check ride history:', error);
	//       setRideHistoryStatus('error');
	//     }
	//   }

	//   checkRideHistory();
	// }, [userAddress]);

	/** @dev uncomment when share button gets moved */
	// const handleShareChooChoo = async () => {
	//   try {
	//     // Play ChooChoo sound when button is clicked
	//     playChooChoo({ volume: 0.7 });

	//     let castText: string;
	//     switch (rideHistoryStatus) {
	//       case 'has-ridden':
	//         castText =
	//           "I've ridden @choochoo and so can you! Check out the mini-app for a chance to ride 🚂";
	//         break;
	//       case 'not-ridden':
	//         castText = 'I have @choochoo FOMO!';
	//         break;
	//       case 'loading':
	//       case 'error':
	//       default:
	//         // Fallback text when we can't determine ride history
	//         castText = 'Got @choochoo FOMO? Check out the mini-app for a chance to ride 🚂';
	//         break;
	//     }

	//     await sdk.actions.composeCast({
	//       text: castText,
	//       embeds: [APP_URL],
	//     });
	//   } catch (error) {
	//     console.error('[HomePage] Failed to compose share cast:', error);
	//   }
	// };

	const shouldShowCastingWidget =
		!!context?.user &&
		!isHolderLoading &&
		!isWorkflowLoading &&
		workflowData.state === WorkflowState.NOT_CASTED &&
		isCurrentHolder;

	return (
		<div
			ref={containerRef}
			className="overflow-y-auto h-[calc(100vh-200px)] px-6"
		>
			{!shouldShowCastingWidget && (
				<div className="flex flex-col items-center justify-center py-8">
					{/* <Typography variant="h1" className="text-center mb-4 text-white text-4xl">
          {APP_NAME}
        </Typography> */}
					<Image
						src="https://scarlet-quick-grouse-388.mypinata.cloud/ipfs/QmNQJCBYV2kbqsdZmoCsUQV4Lh6yUqLwMJ3SV1x9ozUo72"
						alt="ChooChoo App Logo"
						width={320}
						height={320}
						priority
						className="rounded-lg shadow-lg border-4"
						style={{ borderColor: "var(--border)" }}
					/>
				</div>
			)}

			{/* App Description */}
			{!shouldShowCastingWidget && (
				<div className="pb-6 text-center px-4">
					<p className="text-gray-300 dark:text-gray-300 leading-relaxed">
						ChooChoo is trying to visit every wallet on Base! When ChooChoo is
						in your wallet, you get to decide where he goes next.
					</p>
					<Button
						variant="link"
						onClick={handleAllAboard}
						className="mt-2 text-gray-300 dark:text-gray-300 hover:text-purple-500
            dark:hover:text-purple-500 transition-colors"
					>
						🚂 All aboard!
					</Button>

					{/* Yoink Timer Display */}
					<div className="mt-4 flex justify-center">
						{countdownState.isLoading ? (
							<Typography variant="body" className="!text-white font-sans">
								Loading countdown...
							</Typography>
						) : countdownState.error ? (
							<Typography variant="body" className="!text-red-300 font-sans">
								Error: {countdownState.error}
							</Typography>
						) : countdownState.isAvailable ? (
							<Button
								onClick={() => setActiveTab("yoink")}
								className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-4 py-2 text-sm"
								style={{ backgroundColor: "#a855f7" }}
							>
								<Typography variant="body" className="!text-white font-sans">
									Yoink ChooChoo now!
								</Typography>
							</Button>
						) : (
							<Typography variant="body" className="!text-white font-sans">
								⏱️ Yoink in: {countdownState.shortFormat}
							</Typography>
						)}
					</div>

					{/* Hide Share ChooChoo button if user is current holder to avoid confusion */}
					{/* {!isCurrentHolder && (
            <div className="mt-4 flex justify-center">
              <Button
                onClick={handleShareChooChoo}
                disabled={isAddressLoading || rideHistoryStatus === 'loading'}
                className="!text-white hover:!text-white !bg-purple-500 !border-2 !border-white px-6 py-2"
                style={{ backgroundColor: '#a855f7' }}
              >
                <Typography variant="small" className="!text-white">
                  {isAddressLoading || rideHistoryStatus === 'loading'
                    ? 'Loading...'
                    : 'Share ChooChoo'}
                </Typography>
              </Button>
            </div>
          )} */}
				</div>
			)}

			{/* Workflow-based UI rendering */}
			{context?.user && !isHolderLoading && !isWorkflowLoading && (
				<div className="w-full max-w-md mx-auto mb-8 flex flex-col items-center justify-center">
					{/* NOT_CASTED: Show casting widget only to current holder */}
					{workflowData.state === WorkflowState.NOT_CASTED &&
						isCurrentHolder && (
							<>
								<Typography
									variant="body"
									className="text-center mb-4 text-gray-100 dark:text-gray-100"
								>
									You&apos;re the current passenger! Send out a cast to let
									everyone know. After, you&apos;ll be able to choose where
									ChooChoo goes next.
								</Typography>
								<div
									ref={castingWidgetRef}
									className="w-full flex justify-center"
								>
									<CastingWidget onCastSent={handleWorkflowRefresh} />
								</div>
							</>
						)}

					{/* CASTED: Show winner selection widget only to current holder */}
					{workflowData.state === WorkflowState.CASTED && isCurrentHolder && (
						<div ref={winnerSelectionRef} className="w-full">
							<WinnerSelectionWidget onTokenMinted={handleWorkflowRefresh} />
						</div>
					)}

					{/* CHANCE_ACTIVE & CHANCE_EXPIRED: Show public chance widget to everyone */}
					{(workflowData.state === WorkflowState.CHANCE_ACTIVE ||
						workflowData.state === WorkflowState.CHANCE_EXPIRED) && (
						<div ref={publicChanceRef} className="w-full space-y-4">
							<PublicChanceWidget />
						</div>
					)}

					{/* MANUAL_SEND: Show loading state */}
					{workflowData.state === WorkflowState.MANUAL_SEND && (
						<div className="w-full text-center">
							<Typography
								variant="body"
								className="text-gray-300 dark:text-gray-300"
							>
								🚂 ChooChoo is on the move...
							</Typography>
						</div>
					)}

					{/* Cast announcement: visible to non-holders whenever state is not NOT_CASTED */}
					{!isCurrentHolder &&
						workflowData.state !== WorkflowState.NOT_CASTED &&
						workflowData.currentCastHash && (
							<div
								ref={castDisplayRef}
								className="w-full mt-4 flex justify-center"
							>
								<CastDisplayWidget castHash={workflowData.currentCastHash} />
							</div>
						)}
				</div>
			)}

			{/* Current Stop Section */}
			<div ref={currentHolderRef} className="w-full max-w-md mx-auto mb-8">
				<Typography
					variant="h3"
					className="text-center mb-4 text-gray-100 dark:text-gray-100"
				>
					ChooChoo&apos;s Journey
				</Typography>
				<CurrentHolderItem refreshOnMintTrigger={timelineRefreshTrigger} />
			</div>

			<div className="pb-8">
				<JourneyTimeline refreshOnMintTrigger={timelineRefreshTrigger} />
			</div>

			{/* Credits Section */}
			<div className="pb-8 border-t border-gray-200 dark:border-gray-200 pt-6 mt-8">
				<div className="text-center space-y-2">
					<p className="text-sm text-white dark:text-white">
						Artwork by{" "}
						<a
							href="https://farcaster.xyz/yonfrula"
							target="_blank"
							rel="noopener noreferrer"
							className="text-purple-400 dark:text-purple-400 hover:underline font-medium"
						>
							@yonfrula
						</a>
					</p>
					<p className="text-sm text-white dark:text-white">
						Built by{" "}
						<a
							href="https://farcaster.xyz/jonbray.eth"
							target="_blank"
							rel="noopener noreferrer"
							className="text-purple-400 dark:text-purple-400 hover:underline font-medium"
						>
							@jonbray.eth
						</a>
					</p>
					<p className="text-sm text-white dark:text-white">
						Base 🔵 | Farcaster 💜
					</p>
				</div>
			</div>

			{/* Scroll Indicator */}
			{showScrollIndicator && (
				<div className="fixed bottom-32 right-6 z-50">
					{/** biome-ignore lint/a11y/noStaticElementInteractions: basically a button */}
					{/** biome-ignore lint/a11y/useKeyWithClickEvents: basically a button */}
					<div
						className={`
              bg-purple-600 text-white rounded-full p-2 shadow-lg cursor-pointer
              transition-all duration-300 ease-in-out
              ${hasScrolled ? "scale-90" : "scale-100"}
              hover:bg-purple-700 hover:scale-105
            `}
						onClick={() => {
							const target = getScrollTarget();
							const root = containerRef.current;
							if (target && root) {
								const offset =
									target.offsetTop - root.offsetTop - root.clientHeight * 0.2;
								const top = Math.max(0, offset);
								root.scrollTo({ top, behavior: "smooth" });
							}
						}}
					>
						<ChevronsDown
							size={hasScrolled ? 20 : 24}
							className="transition-all duration-300"
						/>
					</div>
				</div>
			)}
		</div>
	);
}
