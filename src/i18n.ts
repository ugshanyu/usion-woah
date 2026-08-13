const messages = {
  en: {
    title: 'WOAH', subtitle: 'Swipe. Look. Dodge.', start: 'Enable camera', privacy: 'Your camera is shared only with your opponent over an encrypted peer-to-peer connection. Face-direction detection stays on this device. Nothing is recorded.',
    cameraDenied: 'Camera access is needed to play. Allow it in your device settings, then try again.', cameraError: 'The camera is unavailable. Close other camera apps or switch cameras, then try again.', visionError: 'Face-direction detection could not start. Reopen the game and try again on a stable connection.', retry: 'Try again', models: 'Preparing face detection…', slow: 'This device is processing slowly. Keep the phone still and close other apps.',
    neutral: 'Face forward', left: 'Look to your left', right: 'Look to your right', up: 'Look up', down: 'Look down',
    faceSearching: 'Center your whole face in the frame', faceMoveMore: 'Turn a little farther in the shown direction', faceHold: 'Face detected — hold still', faceRecognized: 'Direction recognized', calibrationRestart: 'Directions were not clear enough — face forward and try again', calibrated: 'Ready!', swipeArea: 'Swipe direction control', swipeHint: 'Swipe on WOAH', swipeAccepted: 'Direction locked', swipeTiming: 'Wait for WOAH, then swipe',
    share: 'Use the Share button above to invite one friend.', waiting: 'Waiting for your opponent…', opponentReady: 'Opponent is ready', connecting: 'Connecting cameras…', syncing: 'Synchronizing the beat…', reconnecting: 'Reconnecting — the round is paused', networkUnsupported: 'A direct camera connection could not be created on this network. Switch Wi-Fi or mobile data, then reopen the game.',
    pointer: 'SWIPE', looker: 'LOOK AWAY', pointerHint: 'Swipe up, down, left, or right on WOAH.', lookerHint: 'Turn your head in a different direction on WOAH.', judging: 'Checking the captured moment…',
    hit: 'HIT!', dodge: 'DODGED!', void: 'REPLAY', hitDetail: 'The swipe and head directions matched.', dodgeDetail: 'The swipe and head directions were different.', voidDetail: 'The timing or face confidence was not clear.',
    gameover: 'Match complete', you: 'You', opponent: 'Opponent', firstTo: 'First to 3', cameraEnded: 'The camera stopped. Start again to continue.',
  },
  mn: {
    title: 'WOAH', subtitle: 'Шудар. Хар. Булт.', start: 'Камераа асаах', privacy: 'Камерын дүрс зөвхөн өрсөлдөгчтэй шифрлэгдсэн P2P холболтоор хуваалцана. Нүүрний чиглэл таних ажиллагаа энэ төхөөрөмж дээр хийгдэж, юу ч бичигдэхгүй.',
    cameraDenied: 'Тоглохын тулд камерын эрх хэрэгтэй. Төхөөрөмжийн тохиргооноос зөвшөөрөөд дахин оролдоно уу.', cameraError: 'Камер ашиглах боломжгүй байна. Камер ашиглаж буй бусад аппыг хаах эсвэл камераа солиод дахин оролдоно уу.', visionError: 'Нүүрний чиглэл танигч ассангүй. Тоглоомыг дахин нээгээд тогтвортой сүлжээн дээр оролдоно уу.', retry: 'Дахин оролдох', models: 'Нүүрний чиглэл танигчийг бэлдэж байна…', slow: 'Төхөөрөмж удаан боловсруулж байна. Утсаа тогтвортой барьж, бусад аппыг хаана уу.',
    neutral: 'Эгц урагшаа хар', left: 'Өөрийн зүүн тийш хар', right: 'Өөрийн баруун тийш хар', up: 'Дээш хар', down: 'Доош хар',
    faceSearching: 'Нүүрээ хүрээний голд бүтнээр нь харуулна уу', faceMoveMore: 'Заасан чиглэл рүү арай илүү эргүүлнэ үү', faceHold: 'Нүүр танигдлаа — хөдөлгөөнгүй барина уу', faceRecognized: 'Чиглэл танигдлаа', calibrationRestart: 'Чиглэл хангалттай тод байсангүй — урагшаа харж дахин эхэлнэ үү', calibrated: 'Бэлэн!', swipeArea: 'Шудрах чиглэлийн талбар', swipeHint: 'WOAH дээр шудар', swipeAccepted: 'Чиглэл авлаа', swipeTiming: 'WOAH-аа хүлээгээд шудар',
    share: 'Дээрх Share товчоор нэг найзаа урина уу.', waiting: 'Өрсөлдөгчөө хүлээж байна…', opponentReady: 'Өрсөлдөгч бэлэн', connecting: 'Камеруудыг холбож байна…', syncing: 'Цохилтын цагийг тааруулж байна…', reconnecting: 'Дахин холбогдож байна — үеийг түр зогсоолоо', networkUnsupported: 'Энэ сүлжээнд камерын шууд холболт үүссэнгүй. Wi-Fi эсвэл мобайл датагаа солиод тоглоомоо дахин нээнэ үү.',
    pointer: 'ШУДАР', looker: 'ЗӨРЖ ХАР', pointerHint: 'WOAH дээр дээш, доош, зүүн эсвэл баруун тийш шудар.', lookerHint: 'WOAH дээр шударсан чиглэлээс өөр тийш толгойгоо эргүүл.', judging: 'Тухайн агшны хөдөлгөөнийг шалгаж байна…',
    hit: 'ТААРЛАА!', dodge: 'БУЛТЛАА!', void: 'ДАХИН', hitDetail: 'Swipe, толгойн чиглэл хоёр таарсан.', dodgeDetail: 'Swipe, толгойн чиглэл хоёр өөр байлаа.', voidDetail: 'Timing эсвэл нүүрний танилт хангалттай тод байсангүй.',
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
