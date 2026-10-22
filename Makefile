ARCHS = arm64 arm64e
TARGET = iphone:clang:latest:15.0
THEOS_PACKAGE_SCHEME = roothide
INSTALL_TARGET_PROCESSES = LinkedIn

include $(THEOS)/makefiles/common.mk
TWEAK_NAME = LinkedWin
LinkedWin_FILES = Tweak.m
LinkedWin_FRAMEWORKS = Foundation UIKit WebKit
LinkedWin_CFLAGS = -fobjc-arc
include $(THEOS_MAKE_PATH)/tweak.mk

before-all::
	@node scripts/bundle.cjs
