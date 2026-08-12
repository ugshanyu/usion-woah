const messages = {
  en: {
    title: 'WOAH', subtitle: 'Point. Look. Dodge.', start: 'Enable camera', privacy: 'Your camera is shared only with your opponent over an encrypted peer-to-peer connection. Movement detection stays on this device. Nothing is recorded.',
    cameraDenied: 'Camera access is needed to play. Allow it in your device settings, then try again.', setupError: 'Camera or movement detection could not start. Check your connection and try again.', retry: 'Try again', models: 'Preparing movement detection…', slow: 'This device is processing slowly. Keep the phone still and close other apps.',
    neutral: 'Face forward', left: 'Look to your left', right: 'Look to your right', up: 'Look up', down: 'Look down',
    pointLeft: 'Point to your left', pointRight: 'Point to your right', pointUp: 'Point up', pointDown: 'Point down', hold: 'Hold that position', retryPose: 'Could not see it — try again', calibrated: 'Ready!',
    share: 'Use the Share button above to invite one friend.', waiting: 'Waiting for your opponent…', opponentReady: 'Opponent is ready', connecting: 'Connecting cameras…', syncing: 'Synchronizing the beat…', reconnecting: 'Reconnecting — the round is paused',
    pointer: 'POINT', looker: 'LOOK AWAY', pointerHint: 'Point up, down, left, or right on WOAH.', lookerHint: 'Turn your head in a different direction on WOAH.', judging: 'Checking the captured moment…',
    hit: 'HIT!', dodge: 'DODGED!', void: 'REPLAY', hitDetail: 'Both directions matched.', dodgeDetail: 'The directions were different.', voidDetail: 'The timing or camera confidence was not clear.',
    gameover: 'Match complete', you: 'You', opponent: 'Opponent', firstTo: 'First to 3', cameraEnded: 'The camera stopped. Start again to continue.',
  },
  mn: {
    title: 'WOAH', subtitle: 'Заа. Хар. Булт.', start: 'Камераа асаах', privacy: 'Камерын дүрс зөвхөн өрсөлдөгчтэй шифрлэгдсэн P2P холболтоор хуваалцана. Хөдөлгөөн таних ажиллагаа энэ төхөөрөмж дээр хийгдэж, юу ч бичигдэхгүй.',
    cameraDenied: 'Тоглохын тулд камерын эрх хэрэгтэй. Төхөөрөмжийн тохиргооноос зөвшөөрөөд дахин оролдоно уу.', setupError: 'Камер эсвэл хөдөлгөөн танигч ассангүй. Холболтоо шалгаад дахин оролдоно уу.', retry: 'Дахин оролдох', models: 'Хөдөлгөөн танигчийг бэлдэж байна…', slow: 'Төхөөрөмж удаан боловсруулж байна. Утсаа тогтвортой барьж, бусад аппыг хаана уу.',
    neutral: 'Эгц урагшаа хар', left: 'Өөрийн зүүн тийш хар', right: 'Өөрийн баруун тийш хар', up: 'Дээш хар', down: 'Доош хар',
    pointLeft: 'Өөрийн зүүн тийш заа', pointRight: 'Өөрийн баруун тийш заа', pointUp: 'Дээш заа', pointDown: 'Доош заа', hold: 'Энэ байрлалаа бариарай', retryPose: 'Сайн харагдсангүй — дахин оролдоорой', calibrated: 'Бэлэн!',
    share: 'Дээрх Share товчоор нэг найзаа урина уу.', waiting: 'Өрсөлдөгчөө хүлээж байна…', opponentReady: 'Өрсөлдөгч бэлэн', connecting: 'Камеруудыг холбож байна…', syncing: 'Цохилтын цагийг тааруулж байна…', reconnecting: 'Дахин холбогдож байна — үеийг түр зогсоолоо',
    pointer: 'ЗАА', looker: 'ЗӨРЖ ХАР', pointerHint: 'WOAH дээр дээш, доош, зүүн эсвэл баруун тийш заа.', lookerHint: 'WOAH дээр гараас өөр чиглэл рүү толгойгоо эргүүл.', judging: 'Тухайн агшны хөдөлгөөнийг шалгаж байна…',
    hit: 'ТААРЛАА!', dodge: 'БУЛТЛАА!', void: 'ДАХИН', hitDetail: 'Гар, толгой хоёр нэг чиглэлд таарсан.', dodgeDetail: 'Гар, толгой хоёр өөр чиглэлд байлаа.', voidDetail: 'Timing эсвэл камерын танилт хангалттай тод байсангүй.',
    gameover: 'Тоглолт дууслаа', you: 'Та', opponent: 'Өрсөлдөгч', firstTo: '3 оноонд түрүүлнэ', cameraEnded: 'Камер зогслоо. Үргэлжлүүлэхийн тулд дахин асаана уу.',
  },
} as const;

export type MessageKey = keyof typeof messages.en;

export function languageFor(value?: string): keyof typeof messages {
  return value?.toLowerCase().startsWith('mn') ? 'mn' : 'en';
}

export function translator(language: keyof typeof messages): (key: MessageKey) => string {
  return (key) => messages[language][key] ?? messages.en[key];
}
