// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use inputbot::KeybdKey::*;
use std::thread::sleep;
use std::time::{Duration, SystemTime};
use tauri::AppHandle;
use tauri::Manager;
use winapi::um::winuser::GetKeyboardLayout;

#[derive(Clone, serde::Serialize)]
struct Payload {
    strafe_type: String,
    duration: u128,
}

fn eval_understrafe(elapsed: Duration, released_time: &mut Option<SystemTime>, app: AppHandle) {
    let time_passed = elapsed.as_micros();
    if time_passed < (200 * 1000) && time_passed > (1600) {
        // println!("Early release");
        // println!("{0}.{1}", time_passed / 1000, time_passed % 1000);
        app.emit_all(
            "strafe",
            Payload {
                strafe_type: "Early".into(),
                duration: time_passed,
            },
        )
        .unwrap();
    } else if time_passed < 1600 {
        // println!("Perfect");
        app.emit_all(
            "strafe",
            Payload {
                strafe_type: "Perfect".into(),
                duration: 0,
            },
        )
        .unwrap();
    }
    *released_time = None;
}

fn eval_overstrafe(elapsed: Duration, both_pressed_time: &mut Option<SystemTime>, app: AppHandle) {
    let time_passed = elapsed.as_micros();
    if time_passed < (200 * 1000) {
        // println!("Late release");
        // println!("{0}.{1}", time_passed / 1000, time_passed % 1000);
        app.emit_all(
            "strafe",
            Payload {
                strafe_type: "Late".into(),
                duration: time_passed,
            },
        )
        .unwrap();
    } else {
        // println!("Ignored overstrafe due to time too large")
    }
    *both_pressed_time = None;
}

fn is_azerty_layout() -> bool {
    unsafe {
        let layout = GetKeyboardLayout(0);
        let layout_id = layout as u32 & 0xFFFF;
        return layout_id == 0x040C;
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();

            tauri::async_runtime::spawn(async move {
                let mut left_pressed = false;
                let mut right_pressed = false;
                let mut both_pressed_time: Option<SystemTime> = None;
                let mut right_released_time: Option<SystemTime> = None;
                let mut left_released_time: Option<SystemTime> = None;
                let is_azerty = is_azerty_layout();
                loop {
                    // Tickrate
                    sleep(Duration::from_millis(1));

                    // Key detection
                    if right_pressed && !DKey.is_pressed() && !RightKey.is_pressed() {
                        // D released
                        right_pressed = false;
                        let _ = handle.emit_all("d-released", ());
                        right_released_time = Some(SystemTime::now());
                    }
                    if left_pressed
                        && (is_azerty || !AKey.is_pressed())
                        && (!is_azerty || !QKey.is_pressed())
                        && !LeftKey.is_pressed()
                    {
                        // A released
                        left_pressed = false;
                        let _ = handle.emit_all("a-released", ());
                        left_released_time = Some(SystemTime::now());
                    }

                    if ((!is_azerty && AKey.is_pressed())
                        || (is_azerty && QKey.is_pressed())
                        || LeftKey.is_pressed())
                        && !left_pressed
                    {
                        // A pressed
                        left_pressed = true;
                        let _ = handle.emit_all("a-pressed", ());
                        match right_released_time {
                            None => {}
                            Some(x) => match x.elapsed() {
                                Ok(elapsed) => eval_understrafe(
                                    elapsed,
                                    &mut right_released_time,
                                    handle.clone(),
                                ),
                                Err(e) => {
                                    println!("Error: {e:?}");
                                }
                            },
                        }
                    }

                    if (DKey.is_pressed() || RightKey.is_pressed()) && !right_pressed {
                        // D pressed
                        right_pressed = true;
                        let _ = handle.emit_all("d-pressed", ());
                        match left_released_time {
                            None => {}
                            Some(x) => match x.elapsed() {
                                Ok(elapsed) => eval_understrafe(
                                    elapsed,
                                    &mut left_released_time,
                                    handle.clone(),
                                ),
                                Err(e) => {
                                    println!("Error: {e:?}");
                                }
                            },
                        }
                    }

                    // Evaluation
                    if left_pressed && right_pressed && both_pressed_time == None {
                        both_pressed_time = Some(SystemTime::now());
                    }

                    if (!left_pressed || !right_pressed) && both_pressed_time != None {
                        match both_pressed_time {
                            None => {}
                            Some(x) => {
                                match x.elapsed() {
                                    Ok(elapsed) => {
                                        // Overlap time
                                        eval_overstrafe(
                                            elapsed,
                                            &mut both_pressed_time,
                                            handle.clone(),
                                        )
                                    }
                                    Err(e) => {
                                        println!("Error: {e:?}");
                                    }
                                }
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run app");
}
